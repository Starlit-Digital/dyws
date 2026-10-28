<?php
declare(strict_types=1);
namespace dyws;

/** Restaurant offers, account claims and atomic single use redemption. All money is integer cents. */
final class Deals {
 public function __construct(private Store $store,private array $catalog,private string $timeZone='America/Edmonton'){}
 public static function validate(mixed $input,array $itemIds):array {
  if(!is_array($input)||!array_is_list($input)||count($input)>100)throw new ApiError('Use up to 100 deals.');
  $out=[];$seen=[];
  foreach($input as $d){
   if(!is_array($d))throw new ApiError('Invalid deal.');
   $id=$d['id']??null;if(!is_string($id)||!preg_match('/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/D',$id)||isset($seen[$id]))throw new ApiError('Deals need unique stable IDs.');$seen[$id]=true;
   $v=['id'=>$id,'name'=>Store::text($d['name']??null,120),'description'=>Store::text($d['description']??'',1000,false),'enabled'=>$d['enabled']??true,'type'=>$d['type']??null,'itemIds'=>$d['itemIds']??[],'days'=>$d['days']??range(0,6),'startsOn'=>$d['startsOn']??'1970-01-01','endsOn'=>$d['endsOn']??null,'claimDays'=>$d['claimDays']??30,'buyQuantity'=>$d['buyQuantity']??1,'getQuantity'=>$d['getQuantity']??1,'amountOff'=>$d['amountOff']??0,'percentBasisPoints'=>$d['percentBasisPoints']??0,'minSpend'=>$d['minSpend']??0,'maxApplications'=>$d['maxApplications']??1];
   if(!is_bool($v['enabled'])||!in_array($v['type'],['quantity','buy_amount_off','spend_amount_off','spend_percent'],true))throw new ApiError('Choose a supported deal type.');
   if(!is_array($v['itemIds'])||!array_is_list($v['itemIds'])||count($v['itemIds'])>100||count(array_unique($v['itemIds'],SORT_REGULAR))!==count($v['itemIds']))throw new ApiError('Choose the eligible menu items.');
   foreach($v['itemIds'] as $item)if(!is_string($item)||!in_array($item,$itemIds,true))throw new ApiError('A deal references an unknown item.');
   if(in_array($v['type'],['quantity','buy_amount_off'],true)&&!$v['itemIds'])throw new ApiError('Choose at least one eligible item for a quantity deal.');
   if(!is_array($v['days'])||!array_is_list($v['days'])||!$v['days']||count($v['days'])>7||count(array_unique($v['days'],SORT_REGULAR))!==count($v['days']))throw new ApiError('Choose the days when the deal can be used.');
   foreach($v['days'] as $day)if(!is_int($day)||$day<0||$day>6)throw new ApiError('Choose valid weekdays.');sort($v['days']);
   foreach(['startsOn','endsOn'] as $key){$date=is_string($v[$key])?\DateTimeImmutable::createFromFormat('!Y-m-d',$v[$key]):false;if(!$date||$date->format('Y-m-d')!==$v[$key])throw new ApiError('Set valid start and expiration dates.');}
   if($v['endsOn']<$v['startsOn'])throw new ApiError('Expiration must be on or after the start date.');
   foreach(['claimDays'=>[1,365],'buyQuantity'=>[1,10],'getQuantity'=>[1,10],'amountOff'=>[0,100000],'percentBasisPoints'=>[0,10000],'minSpend'=>[0,100000],'maxApplications'=>[1,20]] as $key=>[$min,$max])if(!is_int($v[$key])||$v[$key]<$min||$v[$key]>$max)throw new ApiError('Check the deal amounts, quantities and claim lifetime.');
   if(in_array($v['type'],['buy_amount_off','spend_amount_off'],true)&&$v['amountOff']<1||$v['type']==='spend_percent'&&$v['percentBasisPoints']<1)throw new ApiError('Enter a positive discount.');
   $out[]=$v;
  }return $out;
 }
 private static function now(string $zone,?int $now=null):\DateTimeImmutable{return (new \DateTimeImmutable('@'.($now??time())))->setTimezone(new \DateTimeZone($zone));}
 public static function active(array $d,string $zone,?int $now=null):bool {$n=self::now($zone,$now);$date=$n->format('Y-m-d');return $d['enabled']&&$date>=$d['startsOn']&&$date<=$d['endsOn']&&in_array((int)$n->format('N')-1,$d['days'],true);}
 public static function description(array $d,string $currency='CAD'):string {
  $money=fn($c)=>($currency==='USD'?'US$':'$').number_format($c/100,2,'.',',');
  $text=match($d['type']){'quantity'=>($d['buyQuantity']+$d['getQuantity']).' for '.$d['buyQuantity'],'buy_amount_off'=>'Buy '.$d['buyQuantity'].', get '.$money($d['amountOff']).' off '.$d['getQuantity'].' more','spend_amount_off'=>$money($d['amountOff']).' off','spend_percent'=>rtrim(rtrim(number_format($d['percentBasisPoints']/100,2,'.',''),'0'),'.').'% off'};
  if($d['minSpend'])$text.=' when eligible items total '.$money($d['minSpend']).' or more';
  if(in_array($d['type'],['quantity','buy_amount_off'],true))$text.='. Discount applies to the lowest priced eligible items. Up to '.$d['maxApplications'].' group'.($d['maxApplications']===1?'':'s').' per order.';
  return $text;
 }
 public static function publicList(array $catalog,string $zone,?int $now=null):array {
  $date=self::now($zone,$now)->format('Y-m-d');$out=[];$active=[];foreach($catalog['categories']??[] as $category)foreach($category['items'] as $item)if($item['active']??true)$active[]=$item['id'];
  foreach($catalog['deals']??[] as $d){if(!$d['enabled']||$d['endsOn']<$date)continue;if($d['itemIds']){$d['itemIds']=array_values(array_intersect($d['itemIds'],$active));if(!$d['itemIds'])continue;}
   $d['rule']=self::description($d,$catalog['currency']);$d['activeNow']=self::active($d,$zone,$now);$d['canClaim']=$d['startsOn']<=$date;$d['timeZone']=$zone;
   $d['schedule']=implode(', ',array_map(fn($i)=>['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][$i],$d['days']));$out[]=$d;
  }return $out;
 }
 /** Discount the cheapest eligible units or allocate a threshold discount proportionally. */
 public static function calculate(array $deal,array $lines):array {
  $units=[];$eligible=0;
  foreach($lines as $n=>$l)if(!$deal['itemIds']||in_array($l['id'],$deal['itemIds'],true)){for($i=0;$i<$l['quantity'];$i++)$units[]=['line'=>$n,'price'=>$l['price']];$eligible+=$l['price']*$l['quantity'];}
  $discounts=array_fill(0,count($lines),0);$discount=0;
  if($eligible<$deal['minSpend']||!$units)throw new ApiError('This order does not meet the deal requirements.');
  if(in_array($deal['type'],['quantity','buy_amount_off'],true)){
   $groups=min($deal['maxApplications'],intdiv(count($units),$deal['buyQuantity']+$deal['getQuantity']));if(!$groups)throw new ApiError('Add enough eligible items to use this deal.');
   usort($units,fn($a,$b)=>($a['price']<=>$b['price'])?:($a['line']<=>$b['line']));
   foreach(array_slice($units,0,$groups*$deal['getQuantity']) as $unit){$off=$deal['type']==='quantity'?$unit['price']:min($unit['price'],$deal['amountOff']);$discounts[$unit['line']]+=$off;$discount+=$off;}
  }else{
   $discount=min($eligible,$deal['type']==='spend_amount_off'?$deal['amountOff']:intdiv($eligible*$deal['percentBasisPoints']+5000,10000));$assigned=0;
   foreach($lines as $n=>$l)if(!$deal['itemIds']||in_array($l['id'],$deal['itemIds'],true)){$discounts[$n]=intdiv($discount*$l['price']*$l['quantity'],max(1,$eligible));$assigned+=$discounts[$n];}
   foreach($lines as $n=>$l)if($assigned<$discount&&(!$deal['itemIds']||in_array($l['id'],$deal['itemIds'],true))&&$discounts[$n]<$l['price']*$l['quantity']){$discounts[$n]++;$assigned++;}
  }
  if(!$discount)throw new ApiError('The selected deal does not reduce this order.');
  foreach($lines as $n=>&$line)if($discounts[$n])$line['discount']=$discounts[$n];unset($line);
  return ['discount'=>$discount,'lines'=>$lines];
 }
 private function offer(string $id):array {foreach($this->catalog['deals']??[] as $d)if($d['id']===$id&&$d['enabled'])return $d;throw new ApiError('This deal is no longer available.',409);}
 public function listing(?string $owner):array {
  $claims=[];$active=null;
  if($owner)foreach($this->store->query('SELECT * FROM deal_claims WHERE tenant=? AND owner=? ORDER BY claimed_at DESC,id',[$this->store->tenant,$owner]) as $row){
   $d=json_decode($row['deal_json'],true);$state=$row['used_order_id']?'used':($row['expires_at']<=time()?'expired':'ready');
   if($state==='ready'){try{$current=$this->offer($d['id']);if($current['endsOn']<self::now($this->timeZone)->format('Y-m-d'))$state='expired';elseif(!self::active($d,$this->timeZone)||!self::active($current,$this->timeZone))$state='scheduled';}catch(ApiError){$state='unavailable';}}
   if($row['active']&&$state==='ready')$active=$row['id'];$claims[]=['id'=>$row['id'],'deal'=>$d,'rule'=>self::description($d,$this->catalog['currency']),'expiresAt'=>(int)$row['expires_at'],'state'=>$state,'active'=>(bool)$row['active']];
  }
  return ['offers'=>self::publicList($this->catalog,$this->timeZone),'claims'=>$claims,'activeClaimId'=>$active,'signInRequired'=>$owner===null,'timeZone'=>$this->timeZone,'currency'=>$this->catalog['currency']];
 }
 public function claim(string $owner,string $id):array {
  return $this->store->transaction(function()use($owner,$id){$d=$this->offer($id);$now=time();$date=self::now($this->timeZone)->format('Y-m-d');if($date<$d['startsOn']||$date>$d['endsOn'])throw new ApiError('This deal is outside its claim dates.',409);
   $existing=$this->store->query('SELECT * FROM deal_claims WHERE tenant=? AND owner=? AND deal_id=?',[$this->store->tenant,$owner,$id])[0]??null;
   if($existing){if($existing['used_order_id']||$existing['expires_at']<=$now)throw new ApiError('This deal has already been used or expired.',409);$claim=$existing['id'];}
   else{$claim='CLM-'.strtoupper(bin2hex(random_bytes(12)));$ends=(new \DateTimeImmutable($d['endsOn'].' 00:00:00',new \DateTimeZone($this->timeZone)))->modify('+1 day')->getTimestamp();$expiry=min($ends,$now+$d['claimDays']*86400,str_starts_with($owner,'demo:')?$now+86400:PHP_INT_MAX);$this->store->execute('INSERT INTO deal_claims(tenant,id,owner,deal_id,deal_json,claimed_at,expires_at,active) VALUES(?,?,?,?,?,?,?,0)',[$this->store->tenant,$claim,$owner,$id,json_encode($d,JSON_THROW_ON_ERROR),$now,$expiry]);}
   $this->activate($owner,$claim);return $this->listing($owner);
  });
 }
 public function activate(string $owner,string $claim):array {
  return $this->store->transaction(function()use($owner,$claim){if($claim!==''&&!$this->store->query('SELECT 1 FROM deal_claims WHERE tenant=? AND owner=? AND id=? AND used_order_id IS NULL AND expires_at>?',[$this->store->tenant,$owner,$claim,time()]))throw new ApiError('This claim is unavailable.',409);
   $this->store->execute('UPDATE deal_claims SET active=CASE WHEN id=? THEN 1 ELSE 0 END WHERE tenant=? AND owner=?',[$claim,$this->store->tenant,$owner]);return $this->listing($owner);
  });
 }
 public function quote(array $lines,?string $owner,string $claim):array {
  $subtotal=array_sum(array_map(fn($l)=>$l['price']*$l['quantity'],$lines));
  if($claim==='')return ['lines'=>$lines,'discount'=>0,'subtotal'=>$subtotal,'deal'=>null];
  if(!$owner)throw new ApiError('Sign in to use your claimed deal.',401);
  $row=$this->store->query('SELECT * FROM deal_claims WHERE tenant=? AND owner=? AND id=? AND used_order_id IS NULL AND expires_at>?',[$this->store->tenant,$owner,$claim,time()])[0]??null;if(!$row)throw new ApiError('This claim has already been used or expired.',409);
  $d=json_decode($row['deal_json'],true);$current=$this->offer($d['id']);if(!self::active($d,$this->timeZone)||!self::active($current,$this->timeZone))throw new ApiError('This deal cannot be used today. Check its scheduled days.',409);
  $result=self::calculate($d,$lines);return $result+['subtotal'=>$subtotal-$result['discount'],'deal'=>['id'=>$d['id'],'claimId'=>$claim,'name'=>$d['name'],'rule'=>self::description($d,$this->catalog['currency'])]];
 }
 public function redeem(string $owner,string $claim,string $order):void {
  $this->store->execute('UPDATE deal_claims SET used_order_id=?,active=0 WHERE tenant=? AND owner=? AND id=? AND used_order_id IS NULL AND expires_at>?',[$order,$this->store->tenant,$owner,$claim,time()]);if(($this->store->query('SELECT changes() AS n')[0]['n']??0)!==1)throw new ApiError('This deal was already redeemed. Review your order.',409);
 }
 /** Locked demos have isolated, fictional wallets. This never creates an email account or session. */
 public static function owner(array $config,CustomerAccounts $customers,bool $create=false):?string {
  $customer=$customers->current();if($customer)return $customer['id'];if(empty($config['demo_lockdown']))return null;
  $name='dyws_deals_'.substr(hash('sha256',$config['tenant']),0,16);$token=$_COOKIE[$name]??'';
  if(!is_string($token)||!preg_match('/^[a-f0-9]{64}$/D',$token)){
   if(!$create)return null;$token=bin2hex(random_bytes(32));setcookie($name,$token,['expires'=>time()+86400,'path'=>rtrim(parse_url($config['public_base_url'],PHP_URL_PATH)?:'','/').'/','secure'=>parse_url($config['public_base_url'],PHP_URL_SCHEME)==='https','httponly'=>true,'samesite'=>'Lax']);$_COOKIE[$name]=$token;
  }return 'demo:'.hash('sha256',$config['tenant'].'|'.$token);
 }
}
