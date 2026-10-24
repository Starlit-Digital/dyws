<?php
declare(strict_types=1);
namespace dyws;
use PDO;
require_once __DIR__.'/DeliveryRuns.php';
use RuntimeException;
final class ApiError extends RuntimeException {public int $http; public function __construct(string $message,int $http=422){parent::__construct($message);$this->http=$http;}}
final class Store {
 private int $transactionDepth=0;
 public PDO $db; private array $catalog; public string $tenant; public ?Plugins $plugins=null;
 public function __construct(string $path,array $catalog,string $tenant='dyws-diner') {
  if(strlen($GLOBALS['dyws_config']['tracking_secret']??'')<32)throw new RuntimeException('Tracking secret must be configured.');$this->catalog=$catalog;$this->tenant=$tenant;
  $this->db=new PDO('sqlite:'.$path,null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
  $this->db->exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;');
  // Rename the old provider tables atomically before creating the neutral ledger schema.
  $this->transaction(function(){
   foreach(['stripe_attempts'=>'payment_attempts','stripe_events'=>'payment_events','stripe_refund_deltas'=>'payment_refund_deltas'] as $old=>$new){
    if($this->query("SELECT name FROM sqlite_master WHERE type='table' AND name=?",[$old])&&!$this->query("SELECT name FROM sqlite_master WHERE type='table' AND name=?",[$new]))$this->db->exec("ALTER TABLE $old RENAME TO $new");
   }
   $this->db->exec(file_get_contents(__DIR__.'/schema.sql'));
  });
  $columns=array_column($this->query('PRAGMA table_info(orders)'),'name');
  foreach(['currency'=>"TEXT NOT NULL DEFAULT 'CAD'",'payment_provider'=>"TEXT NOT NULL DEFAULT 'demo'",'address_json'=>"TEXT NOT NULL DEFAULT '{}'",'plugin_data_json'=>"TEXT NOT NULL DEFAULT '{}'"] as $column=>$definition)if(!in_array($column,$columns,true))$this->db->exec("ALTER TABLE orders ADD COLUMN $column $definition");
 }
 public function transaction(callable $fn){
  $depth=$this->transactionDepth;$savepoint='dyws_tx_'.$depth;
  $this->db->exec($depth?'SAVEPOINT '.$savepoint:'BEGIN IMMEDIATE');$this->transactionDepth++;
  try{$r=$fn();$this->db->exec($depth?'RELEASE SAVEPOINT '.$savepoint:'COMMIT');return $r;}
  catch(\Throwable $e){if($depth){$this->db->exec('ROLLBACK TO SAVEPOINT '.$savepoint);$this->db->exec('RELEASE SAVEPOINT '.$savepoint);}else $this->db->exec('ROLLBACK');throw $e;}
  finally{$this->transactionDepth--;}
 }
 public function query(string $sql,array $args=[]):array{$s=$this->db->prepare($sql);$s->execute($args);return $s->fetchAll();}
 public function execute(string $sql,array $args=[]):void{$s=$this->db->prepare($sql);$s->execute($args);}
 public static function text($value,int $max,bool $required=true):string {if(!is_string($value)||strlen(trim($value))>$max||($required&&trim($value)===''))throw new ApiError('Check the required fields.');return trim($value);}
 public function create(array $body,string $paymentProvider='demo'):array {
  $body=$this->plugins?->applyFilters('order.input',$body)??$body;
  $key=self::text($body['idempotencyKey']??null,80);if(!preg_match('/^[A-Za-z0-9-]{16,80}$/',$key))throw new ApiError('Invalid request key.');
  $customer=$body['customer']??[];$name=self::text($customer['name']??null,100);$phone=self::text($customer['phone']??null,30);if(!preg_match('/^[0-9+() .-]{7,30}$/',$phone))throw new ApiError('Enter a phone number.');
  $notes=self::text($body['notes']??'',500,false);$fulfillment=$body['fulfillment']??'pickup';if(!in_array($fulfillment,['pickup','delivery'],true))throw new ApiError('Choose pickup or delivery.');
  $addressDetails=null;if($fulfillment==='delivery'&&array_key_exists('addressDetails',$body)){if(!is_array($body['addressDetails']))throw new ApiError('Provide the full delivery address.');$addressDetails=[];foreach(['line1'=>120,'line2'=>60,'city'=>80,'region'=>60,'postalCode'=>20,'country'=>60] as $field=>$max)$addressDetails[$field]=self::text($body['addressDetails'][$field]??'', $max,$field!=='line2');if(in_array(strtolower($addressDetails['country']),['ca','canada'],true)&&!preg_match('/^[A-Z]\d[A-Z] ?\d[A-Z]\d$/i',$addressDetails['postalCode']))throw new ApiError('Enter a valid Canadian postal code.');$body['address']=implode(', ',array_filter($addressDetails,fn($v)=>$v!==''));}
  $address=$fulfillment==='delivery'?self::text($body['address']??null,240):'';
  $input=$body['lines']??null;if(!is_array($input)||count($input)<1||count($input)>50)throw new ApiError('Choose between 1 and 50 items.');
  $menu=[];foreach($this->catalog['categories'] as $c)foreach($c['items'] as $i)$menu[$i['id']]=$i;
  $lines=[];$subtotal=0;$seen=[];
  foreach($input as $row){$id=$row['id']??'';$variant=$row['variant']??'';$qty=$row['quantity']??null;if(!is_string($id)||!is_string($variant)||!is_int($qty)||$qty<1||$qty>99||!isset($menu[$id]))throw new ApiError('Invalid product selection.');
   $item=$menu[$id];if(($item['active']??true)!==true)throw new ApiError('This product is unavailable.');$price=$item['price'];$option='';if(!empty($item['variants'])){$found=false;foreach($item['variants'] as $v)if($v['id']===$variant){$price=$v['price'];$option=$v['name'];$found=true;}if(!$found)throw new ApiError('Choose a valid item option.');}elseif($variant!=='')throw new ApiError('Invalid item option.');
   $lineKey=$id.':'.$variant;if(isset($seen[$lineKey]))throw new ApiError('Combine duplicate item quantities.');$seen[$lineKey]=true;
   $lines[]=['id'=>$id,'variant'=>$variant,'name'=>$item['name'],'sku'=>$item['sku']??'','unit'=>$item['unit']??'each','description'=>$item['description']??'','image'=>$item['image']??null,'option'=>$option,'price'=>$price,'quantity'=>$qty];$subtotal+=$price*$qty;
  }
  if($subtotal>100000)throw new ApiError('Demo orders are limited to $1,000.');
  $fee=$fulfillment==='delivery'?($this->catalog['deliveryFee']??395):0;$tax=(int)round(($subtotal+$fee)*$this->catalog['taxBasisPoints']/10000);$total=$subtotal+$fee+$tax;
  $pluginData=$body['pluginData']??[];if(!is_array($pluginData)||count($pluginData)>20||strlen(json_encode($pluginData,JSON_THROW_ON_ERROR))>8192)throw new ApiError('Additional order fields are too large.');
  foreach($pluginData as $plugin=>$value)if(!is_string($plugin)||!preg_match('/^[a-z][a-z0-9-]{0,59}$/D',$plugin)||!is_array($value))throw new ApiError('Invalid additional order fields.');
  $canonical=['lines'=>$lines,'customer'=>['name'=>$name,'phone'=>$phone],'notes'=>$notes,'fulfillment'=>$fulfillment,'address'=>$address];if($addressDetails!==null)$canonical['addressDetails']=$addressDetails;if($pluginData)$canonical['pluginData']=$pluginData;$fingerprint=hash('sha256',json_encode($canonical));
  return $this->transaction(function()use($key,$fingerprint,$canonical,$subtotal,$fee,$tax,$total,$paymentProvider){
   $existing=$this->query('SELECT * FROM orders WHERE tenant=? AND request_key=?',[$this->tenant,$key]);
   if($existing){if(!hash_equals($existing[0]['fingerprint'],$fingerprint))throw new ApiError('Request key was already used for a different order.',409);return $this->receipt($existing[0],$key);}
   $this->plugins?->validate('order.validating',$canonical,['subtotal'=>$subtotal,'tax'=>$tax,'deliveryFee'=>$fee,'total'=>$total,'currency'=>$this->catalog['currency']]);
   $id='DYWS-'.strtoupper(bin2hex(random_bytes(6)));$token=hash_hmac('sha256',$id.'|'.$key,$GLOBALS['dyws_config']['tracking_secret']);
   $now=time();$this->execute('INSERT INTO orders(id,tenant,request_key,fingerprint,tracking_hash,tracking_expires,status,payment_status,fulfillment,customer_name,customer_phone,address,notes,lines_json,subtotal,tax,delivery_fee,total,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[$id,$this->tenant,$key,$fingerprint,hash('sha256',$token),$now+86400,'placed','unpaid',$canonical['fulfillment'],$canonical['customer']['name'],$canonical['customer']['phone'],$canonical['address'],$canonical['notes'],json_encode($canonical['lines']),$subtotal,$tax,$fee,$total,$now,$now]);
   $this->execute('UPDATE orders SET currency=?,payment_provider=?,address_json=? WHERE tenant=? AND id=?',[$this->catalog['currency'],$paymentProvider,json_encode($canonical['addressDetails']??new \stdClass()),$this->tenant,$id]);
   $this->execute('UPDATE orders SET plugin_data_json=? WHERE tenant=? AND id=?',[json_encode($canonical['pluginData']??new \stdClass()),$this->tenant,$id]);
   $this->event($id,'placed','customer');return $this->receipt($this->get($id),$key);
  });
 }
 private function receipt(array $order,string $key):array{return ['id'=>$order['id'],'demo'=>true,'total'=>(int)$order['total'],'paymentProvider'=>$order['payment_provider'],'currency'=>$order['currency'],'trackingToken'=>hash_hmac('sha256',$order['id'].'|'.$key,$GLOBALS['dyws_config']['tracking_secret'])];}
 public function get(string $id):array{$rows=$this->query('SELECT * FROM orders WHERE tenant=? AND id=?',[$this->tenant,$id]);if(!$rows)throw new ApiError('Order not found.',404);return $rows[0];}
 public function event(string $id,string $status,string $actor):void{$this->execute('INSERT INTO events(tenant,order_id,status,actor,created_at) VALUES(?,?,?,?,?)',[$this->tenant,$id,$status,$actor,time()]);}
 public function change(string $id,string $status,string $actor,?string $driver=null,?string $startingRun=null):array{return $this->transaction(function()use($id,$status,$actor,$driver,$startingRun){
  $o=$this->get($id);$runs=new DeliveryRuns($this);if($driver!==null&&$o['driver_id']!==$driver)throw new ApiError('This delivery is not assigned to you.',403);$runs->guardChange($id,$status,$startingRun);
  if($status==='out_for_delivery'&&!$startingRun&&$runs->listing($o['driver_id']??''))throw new ApiError('Finish the assigned delivery run first.',409);
  if($o['payment_provider']!=='demo'&&$o['payment_status']==='unpaid'){
   $attempt=$this->query('SELECT status FROM payment_attempts WHERE tenant=? AND order_id=?',[$this->tenant,$id]);
   if($status!=='cancelled'||($attempt&&!in_array($attempt[0]['status'],['failed','expired'],true)))throw new ApiError('Wait for payment confirmation or checkout expiry before changing this order.',409);
  }
  $transitions=['placed'=>['accepted','cancelled'],'accepted'=>['preparing','cancelled'],'preparing'=>['ready','cancelled'],'ready'=>$o['fulfillment']==='pickup'?['completed','cancelled']:['out_for_delivery','cancelled'],'out_for_delivery'=>['delivered'],'delivered'=>[],'completed'=>[],'cancelled'=>[]];
  if($driver!==null && ($o['driver_id']!==$driver||!in_array($status,['out_for_delivery','delivered'],true)))throw new ApiError('This delivery is not assigned to you.',403);
  if(!in_array($status,$transitions[$o['status']]??[],true))throw new ApiError('This status change is not allowed.',409);
  if($status==='out_for_delivery'&&!$o['driver_id'])throw new ApiError('Assign a driver first.',409);
  if(in_array($status,['delivered','completed'],true)&&!in_array($o['payment_status'],['paid','partially_refunded'],true))throw new ApiError('Payment must be confirmed before completing the order.',409);
  $this->plugins?->validate('order.status_changing',$this->safeOrder($o),$status,$actor);
  $this->execute('UPDATE orders SET status=?,updated_at=? WHERE tenant=? AND id=?',[$status,time(),$this->tenant,$id]);
  if(in_array($status,['cancelled','delivered','completed'],true)){$this->execute('DELETE FROM locations WHERE tenant=? AND order_id=?',[$this->tenant,$id]);$this->execute('DELETE FROM location_shares WHERE tenant=? AND order_id=?',[$this->tenant,$id]);}
  if($status==='delivered')$runs->completed($id);
  $this->event($id,$status,$actor);return $this->safeOrder($this->get($id));
 });}
 public function assign(string $id,string $driver):void{$this->transaction(function()use($id,$driver){$o=$this->get($id);if((new DeliveryRuns($this))->membership($id))throw new ApiError('Cancel the planned run before reassigning this order.',409);if($o['fulfillment']!=='delivery'||in_array($o['status'],['out_for_delivery','delivered','completed','cancelled'],true))throw new ApiError('Driver assignment is not available for this order.',409);$this->execute('UPDATE orders SET driver_id=?,updated_at=? WHERE tenant=? AND id=?',[$driver,time(),$this->tenant,$id]);$this->event($id,'driver_assigned','manager');});}
 public function payment(string $id,string $kind):void{$this->transaction(function()use($id,$kind){$o=$this->get($id);if($o['payment_provider']!=='demo')throw new ApiError('Online payments are confirmed by the payment provider. Manage refunds with that provider.',409);if($kind==='capture'&&($o['payment_status']!=='unpaid'||$o['status']==='cancelled'))throw new ApiError('Payment cannot be recorded.',409);if($kind==='refund'&&$o['payment_status']!=='paid')throw new ApiError('Only a paid order can be refunded.',409);if(!in_array($kind,['capture','refund'],true))throw new ApiError('Unknown payment action.');$this->execute('INSERT INTO payments(tenant,order_id,kind,amount,created_at) VALUES(?,?,?,?,?)',[$this->tenant,$id,$kind,$o['total'],time()]);$this->execute('UPDATE orders SET payment_status=?,updated_at=? WHERE tenant=? AND id=?',[$kind==='capture'?'paid':'refunded',time(),$this->tenant,$id]);$this->event($id,'test_payment_'.$kind,'manager');});}
 public function startLocation(string $id,array $session,string $source):array {
  if(!in_array($source,['device','simulated'],true))throw new ApiError('Choose a GPS source.');
  return $this->transaction(function()use($id,$session,$source){
   $o=$this->get($id);if($o['driver_id']!==$session['subject']||$o['status']!=='out_for_delivery')throw new ApiError('GPS requires your assigned active delivery.',403);
   $key=bin2hex(random_bytes(32));
   $this->execute('DELETE FROM locations WHERE tenant=? AND order_id=?',[$this->tenant,$id]);
   $this->execute('INSERT INTO location_shares(tenant,order_id,driver_id,sharing_hash,auth_hash,source,expires_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(tenant,order_id) DO UPDATE SET driver_id=excluded.driver_id,sharing_hash=excluded.sharing_hash,auth_hash=excluded.auth_hash,source=excluded.source,expires_at=excluded.expires_at',[$this->tenant,$id,$session['subject'],hash('sha256',$key),$session['token_hash'],$source,min(time()+120,$session['expires_at'])]);
   return ['sharingToken'=>$key,'expiresIn'=>120,'source'=>$source];
  });
 }
 public function stopLocation(string $id,array $session,string $key):void {
  $this->transaction(function()use($id,$session,$key){
   $share=$this->query('SELECT order_id FROM location_shares WHERE tenant=? AND order_id=? AND driver_id=? AND auth_hash=? AND sharing_hash=?',[$this->tenant,$id,$session['subject'],$session['token_hash'],hash('sha256',$key)]);
   // Idempotent and scoped to this sharing session, so an old tab cannot stop a new one.
   if($share){$this->execute('DELETE FROM locations WHERE tenant=? AND order_id=?',[$this->tenant,$id]);$this->execute('DELETE FROM location_shares WHERE tenant=? AND order_id=?',[$this->tenant,$id]);}
  });
 }
 public function testLocation(string $id,array $session,array $position):void {
  $share=$this->query('SELECT source,auth_hash FROM location_shares WHERE tenant=? AND order_id=?',[$this->tenant,$id])[0]??null;
  if(!$share||$share['source']!=='simulated'||$share['auth_hash']!==$session['token_hash'])$this->startLocation($id,$session,'simulated');
  $this->execute('UPDATE location_shares SET expires_at=? WHERE tenant=? AND order_id=?',[min(time()+120,$session['expires_at']),$this->tenant,$id]);
  $last=$this->query('SELECT recorded_at FROM locations WHERE tenant=? AND order_id=?',[$this->tenant,$id])[0]['recorded_at']??0;
  if($last<time())$this->locate($id,$session['subject'],['latitude'=>$position['latitude'],'longitude'=>$position['longitude'],'accuracy'=>$position['accuracy']??8,'recordedAt'=>time()]);
 }
 public function heartbeatLocation(string $id,array $session,string $key):void {
  $this->transaction(function()use($id,$session,$key){
   $o=$this->get($id);if($o['driver_id']!==$session['subject']||$o['status']!=='out_for_delivery')throw new ApiError('GPS requires your assigned active delivery.',403);
   $share=$this->query('SELECT order_id FROM location_shares WHERE tenant=? AND order_id=? AND driver_id=? AND auth_hash=? AND sharing_hash=? AND expires_at>?',[$this->tenant,$id,$session['subject'],$session['token_hash'],hash('sha256',$key),time()]);
   if(!$share)throw new ApiError('GPS connection expired. Reconnecting.',403);
   $this->execute('UPDATE location_shares SET expires_at=? WHERE tenant=? AND order_id=?',[min(time()+120,$session['expires_at']),$this->tenant,$id]);
  });
 }
 public function pruneLocations():array {
  return $this->transaction(function(){
   $invalid="SELECT ls.order_id FROM location_shares ls LEFT JOIN sessions s ON s.token_hash=ls.auth_hash AND s.tenant=ls.tenant AND s.role='driver' AND s.subject=ls.driver_id LEFT JOIN orders o ON o.tenant=ls.tenant AND o.id=ls.order_id WHERE ls.tenant=? AND (ls.expires_at<=? OR s.token_hash IS NULL OR s.expires_at<=? OR o.status<>'out_for_delivery' OR o.driver_id<>ls.driver_id)";
   $ids=array_column($this->query($invalid,[$this->tenant,time(),time()]),'order_id');
   $this->execute('DELETE FROM locations WHERE tenant=? AND (recorded_at<=? OR order_id IN ('.$invalid.'))',[$this->tenant,time()-900,$this->tenant,time(),time()]);
   $this->execute('DELETE FROM location_shares WHERE tenant=? AND order_id IN ('.$invalid.')',[$this->tenant,$this->tenant,time(),time()]);
   return $ids;
  });
 }
 public function locate(string $id,string $driver,array $b,?array $session=null):void {
  $this->transaction(function()use($id,$driver,$b,$session){
   $o=$this->get($id);if($o['driver_id']!==$driver||$o['status']!=='out_for_delivery')throw new ApiError('Location sharing is only available for your active delivery.',403);
   // HTTP callers must present the short lived sharing token as well as their login.
   if($session!==null){
    $key=self::text($b['sharingToken']??null,64);
    $share=$this->query('SELECT * FROM location_shares WHERE tenant=? AND order_id=? AND driver_id=? AND auth_hash=? AND sharing_hash=? AND expires_at>?',[$this->tenant,$id,$driver,$session['token_hash'],hash('sha256',$key),time()]);
    if(!$share)throw new ApiError('GPS sharing ended. Start sharing again for this delivery.',403);
    $auth=$this->query("SELECT token_hash FROM sessions WHERE tenant=? AND token_hash=? AND role='driver' AND subject=? AND expires_at>?",[$this->tenant,$session['token_hash'],$driver,time()]);
    if(!$auth)throw new ApiError('Your session expired. Sign in again.',401);
   }
   $lat=$b['latitude']??null;$lon=$b['longitude']??null;$accuracy=$b['accuracy']??null;$at=$b['recordedAt']??null;
   foreach([$lat,$lon,$accuracy] as $v)if((!is_int($v)&&!is_float($v))||!is_finite((float)$v))throw new ApiError('GPS coordinates and accuracy must be finite numbers.');
   if(!is_int($at)||$lat< -90||$lat>90||$lon< -180||$lon>180||$accuracy<0||$accuracy>5000||$at<time()-180||$at>time()+30)throw new ApiError('Invalid or outdated GPS update.');
   $previous=$this->query('SELECT recorded_at FROM locations WHERE tenant=? AND order_id=?',[$this->tenant,$id]);
   if($previous&&$previous[0]['recorded_at']>=$at)throw new ApiError('GPS update is older than the latest position.',409);
   $this->execute('INSERT INTO locations(tenant,order_id,driver_id,latitude,longitude,accuracy,recorded_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(tenant,order_id) DO UPDATE SET driver_id=excluded.driver_id,latitude=excluded.latitude,longitude=excluded.longitude,accuracy=excluded.accuracy,recorded_at=excluded.recorded_at',[$this->tenant,$id,$driver,$lat,$lon,$accuracy,$at]);
   if($session!==null)$this->execute('UPDATE location_shares SET expires_at=? WHERE tenant=? AND order_id=?',[min(time()+120,$session['expires_at']),$this->tenant,$id]);
  });
 }
 public function locationSummary(string $id):array {
  $rows=$this->query('SELECT s.source,l.recorded_at,l.accuracy,l.latitude,l.longitude FROM location_shares s LEFT JOIN locations l ON l.tenant=s.tenant AND l.order_id=s.order_id WHERE s.tenant=? AND s.order_id=?',[$this->tenant,$id]);$row=$rows[0]??null;
  return ['sharing'=>$row!==null,'source'=>$row['source']??null,'recordedAt'=>isset($row['recorded_at'])?(int)$row['recorded_at']:null,'accuracy'=>$row['accuracy']??null,'location'=>isset($row['recorded_at'])?['latitude'=>(float)$row['latitude'],'longitude'=>(float)$row['longitude'],'accuracy'=>(float)$row['accuracy'],'recorded_at'=>(int)$row['recorded_at']]:null,'stale'=>!isset($row['recorded_at'])||time()-(int)$row['recorded_at']>60];
 }
 public function tracking(string $id,string $token):array{$rows=$this->query('SELECT * FROM orders WHERE tenant=? AND id=? AND tracking_hash=? AND tracking_expires>?',[$this->tenant,$id,hash('sha256',$token),time()]);if(!$rows)throw new ApiError('Tracking link is unavailable or expired.',404);$o=$rows[0];$location=null;if($o['status']==='out_for_delivery'){$locations=$this->query('SELECT latitude,longitude,accuracy,recorded_at FROM locations WHERE tenant=? AND order_id=? AND recorded_at>?',[$this->tenant,$id,time()-900]);$location=$locations[0]??null;}
 return ['id'=>$id,'demo'=>true,'status'=>$o['status'],'paymentStatus'=>$o['payment_status'],'paymentProvider'=>$o['payment_provider'],'checkoutStatus'=>$this->query('SELECT status FROM payment_attempts WHERE tenant=? AND order_id=?',[$this->tenant,$id])[0]['status']??null,'fulfillment'=>$o['fulfillment'],'deliveryAddress'=>$o['address'],'updatedAt'=>(int)$o['updated_at'],'events'=>$this->query('SELECT status,created_at FROM events WHERE tenant=? AND order_id=? ORDER BY id',[$this->tenant,$id]),'location'=>$location,'locationSource'=>$this->locationSummary($id)['source'],'deliveryRun'=>(new DeliveryRuns($this))->progress($id),'gpsStale'=>$location?time()-(int)$location['recorded_at']>60:true];}
 public function safeOrder(array $o):array{$o['pluginData']=json_decode($o['plugin_data_json']??'{}',true);unset($o['plugin_data_json']);$o['addressDetails']=json_decode($o['address_json']??'{}',true);unset($o['address_json']);$o['gps']=$this->locationSummary($o['id']);$o['deliveryRun']=(new DeliveryRuns($this))->membership($o['id']);unset($o['request_key'],$o['fingerprint'],$o['tracking_hash'],$o['tracking_expires']);$o['lines']=json_decode($o['lines_json'],true);unset($o['lines_json']);return $o;}
 public function orders(?string $driver=null):array{$args=[$this->tenant];$sql='SELECT * FROM orders WHERE tenant=?';if($driver!==null){$sql.=' AND driver_id=? AND status IN (\'ready\',\'out_for_delivery\')';$args[]=$driver;}$sql.=" ORDER BY CASE WHEN status IN ('completed','delivered','cancelled') THEN 1 ELSE 0 END, created_at DESC, id LIMIT 200";return array_map(fn($o)=>$this->safeOrder($o),$this->query($sql,$args));}
 public function reports(int $from,int $to):array{
  $o=$this->query('SELECT count(*) AS orderCount,coalesce(sum(total),0) AS orderedValue,coalesce(sum(CASE WHEN status NOT IN (\'completed\',\'delivered\',\'cancelled\') THEN 1 ELSE 0 END),0) AS activeOrders,coalesce(sum(CASE WHEN status=\'cancelled\' THEN 1 ELSE 0 END),0) AS cancelledOrders FROM orders WHERE tenant=? AND created_at>=? AND created_at<?',[$this->tenant,$from,$to])[0];
  $ledger=$this->query('SELECT p.kind,p.amount,o.subtotal,o.tax,o.delivery_fee FROM payments p JOIN orders o ON p.order_id=o.id AND p.tenant=o.tenant WHERE p.tenant=? AND p.created_at>=? AND p.created_at<? AND NOT (p.kind=\'refund\' AND EXISTS (SELECT 1 FROM payment_refund_deltas d WHERE d.tenant=p.tenant AND d.order_id=p.order_id))',[$this->tenant,$from,$to]);
  $ledger=array_merge($ledger,$this->query("SELECT 'refund' AS kind,p.amount,p.subtotal,p.tax,p.delivery_fee FROM payment_refund_deltas p JOIN orders o ON p.order_id=o.id AND p.tenant=o.tenant WHERE p.tenant=? AND p.created_at>=? AND p.created_at<?",[$this->tenant,$from,$to]));$o+=['captured'=>0,'refunded'=>0,'netCollected'=>0,'netSales'=>0,'netTax'=>0,'netDeliveryFees'=>0];foreach($ledger as $p){$sign=$p['kind']==='capture'?1:-1;$o[$p['kind']==='capture'?'captured':'refunded']+=(int)$p['amount'];$o['netCollected']+=$sign*(int)$p['amount'];$total=(int)$p['subtotal']+(int)$p['tax']+(int)$p['delivery_fee'];$ratio=$total?$p['amount']/$total:0;$sales=(int)round($p['subtotal']*$ratio);$fee=(int)round($p['delivery_fee']*$ratio);$o['netSales']+=$sign*$sales;$o['netDeliveryFees']+=$sign*$fee;$o['netTax']+=$sign*($p['amount']-$sales-$fee);}
  $o['averageOrderValue']=$o['orderCount']?(int)round($o['orderedValue']/$o['orderCount']):0;
  $o['byStatus']=$this->query('SELECT status,count(*) AS count FROM orders WHERE tenant=? AND created_at>=? AND created_at<? GROUP BY status',[$this->tenant,$from,$to]);
  $items=[];foreach($this->query('SELECT lines_json FROM orders WHERE tenant=? AND created_at>=? AND created_at<? AND status<>\'cancelled\'',[$this->tenant,$from,$to])as $r)foreach(json_decode($r['lines_json'],true)as $l){$k=$l['id'].':'.$l['variant'];if(!isset($items[$k]))$items[$k]=['name'=>$l['name'],'option'=>$l['option'],'quantity'=>0,'orderedSubtotal'=>0];$items[$k]['quantity']+=$l['quantity'];$items[$k]['orderedSubtotal']+=$l['quantity']*$l['price'];}usort($items,fn($a,$b)=>$b['quantity']<=>$a['quantity']);$o['topItems']=array_slice($items,0,10);
  $o['byFulfillment']=$this->query('SELECT fulfillment,count(*) AS count FROM orders WHERE tenant=? AND created_at>=? AND created_at<? GROUP BY fulfillment',[$this->tenant,$from,$to]);
  $o['averagePreparationSeconds']=null;$o['averageDeliverySeconds']=null;
  foreach(['averagePreparationSeconds'=>['accepted','ready'],'averageDeliverySeconds'=>['out_for_delivery','delivered']] as $metric=>$pair){$rows=$this->query('SELECT avg(e2.created_at-e1.created_at) AS duration FROM events e1 JOIN events e2 ON e1.order_id=e2.order_id AND e1.tenant=e2.tenant JOIN orders ord ON ord.id=e1.order_id AND ord.tenant=e1.tenant WHERE e1.tenant=? AND e1.status=? AND e2.status=? AND ord.created_at>=? AND ord.created_at<?',[$this->tenant,$pair[0],$pair[1],$from,$to]);if($rows[0]['duration']!==null)$o[$metric]=(int)round($rows[0]['duration']);}
  $o['from']=$from;$o['to']=$to;$o['currency']=$this->catalog['currency'];$o['demo']=true;return $o;
 }
}
