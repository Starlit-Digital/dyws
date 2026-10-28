<?php
declare(strict_types=1);
namespace dyws;

/** Customer identities are separate from guest capabilities and operator credentials. */
final class CustomerAccounts {
 public const LINK_SECONDS=900;
 public const SESSION_SECONDS=30*86400;
 private string $cookieName;
 private string $cookiePath;
 public function __construct(private Store $store,private array $config){
  $this->cookiePath=rtrim(parse_url($config['public_base_url']??'',PHP_URL_PATH)?:'','/').'/';
  $this->cookieName='dyws_customer_'.substr(hash('sha256',$store->tenant.'|'.($config['public_base_url']??'')),0,16);
 }
 public function availability():array {
  $mail=$this->config['customer_accounts']??[];
  $base=$this->config['public_base_url']??'';$host=parse_url($base,PHP_URL_HOST);
  $secure=parse_url($base,PHP_URL_SCHEME)==='https'||(parse_url($base,PHP_URL_SCHEME)==='http'&&in_array($host,['127.0.0.1','localhost','[::1]'],true));
  $enabled=empty($this->config['demo_lockdown'])&&($mail['enabled']??false)===true&&$secure&&filter_var($mail['from']??'',FILTER_VALIDATE_EMAIL)&&!preg_match('/[\r\n]/',$mail['from']??'')&&function_exists('mail');
  return ['enabled'=>(bool)$enabled,'message'=>$enabled?'Sign in with your email. Your first sign in creates your account.':(!empty($this->config['demo_lockdown'])?'Customer accounts are unavailable in this shared public demo.':'Customer sign in is not configured for this store yet.')];
 }
 private function enabled():void {if(!$this->availability()['enabled'])throw new ApiError($this->availability()['message'],503);}
 public function guard():void {
  if(($_SERVER['HTTP_X_DYWS_CUSTOMER']??'')!=='1'||($_SERVER['HTTP_SEC_FETCH_SITE']??'')==='cross-site')throw new ApiError('Open your account on this store website.',403);
  if(isset($_SERVER['HTTP_ORIGIN'])){
   $base=parse_url($this->config['public_base_url']);$origin=($base['scheme']??'').'://'.($base['host']??'').(isset($base['port'])?':'.$base['port']:'');
   if(!hash_equals($origin,$_SERVER['HTTP_ORIGIN']))throw new ApiError('Open your account on this store website.',403);
  }
 }
 private function cookieToken():string {$token=$_COOKIE[$this->cookieName]??'';return is_string($token)&&preg_match('/^[a-f0-9]{64}$/D',$token)?$token:'';}
 private function cookie(string $token,int $expires):void {
  setcookie($this->cookieName,$token,['expires'=>$expires,'path'=>$this->cookiePath,'secure'=>parse_url($this->config['public_base_url'],PHP_URL_SCHEME)==='https','httponly'=>true,'samesite'=>'Lax']);
 }
 public function current():?array {
  if(!$this->availability()['enabled'])return null;
  $token=$this->cookieToken();if($token==='')return null;
  return $this->store->query('SELECT c.id,c.email,s.expires_at AS expiresAt FROM customer_sessions s JOIN customers c ON c.tenant=s.tenant AND c.id=s.customer_id WHERE s.tenant=? AND s.token_hash=? AND s.expires_at>?',[$this->store->tenant,hash('sha256',$token),time()])[0]??null;
 }
 public function requireCustomer():array {$this->enabled();$customer=$this->current();if(!$customer)throw new ApiError('Sign in with your email to open your customer account.',401);return $customer;}
 public function state():array {return $this->availability()+['customer'=>$this->current()];}
 private static function email(mixed $value):string {
  return Store::email($value,true);
 }
 public function prune():void {
  foreach(['customer_links','customer_sessions'] as $table)$this->store->execute("DELETE FROM $table WHERE tenant=? AND expires_at<=?",[$this->store->tenant,time()]);
 }
 /** The optional transport is an internal test seam, never a request or config callback. */
 public function requestLink(array $body,?callable $transport=null):array {
  $this->enabled();$email=self::email($body['email']??null);$s=$this->store;$this->prune();
  $reply=['accepted'=>true,'message'=>'Check your email for a sign in link. It expires in 15 minutes.'];
  // Mailbox throttling is shared across source IPs and does not reveal account existence.
  $bucket=hash_hmac('sha256',$s->tenant.'|customer-email|'.$email.'|'.intdiv(time(),900),$this->config['tracking_secret']);
  $allowed=$s->transaction(function()use($s,$bucket){
   $hits=$s->query('SELECT hits FROM limits WHERE bucket=?',[$bucket])[0]['hits']??0;if($hits>=3)return false;
   $s->execute('INSERT INTO limits(bucket,hits,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET hits=hits+1',[$bucket,time()+900]);return true;
  });
  if(!$allowed)return $reply;
  $token=bin2hex(random_bytes(32));$hash=hash('sha256',$token);
  $s->execute('INSERT INTO customer_links(tenant,token_hash,email,expires_at) VALUES(?,?,?,?)',[$s->tenant,$hash,$email,time()+self::LINK_SECONDS]);
  $url=rtrim($this->config['public_base_url'],'/').'/account/#login='.$token;
  $name=Catalog::load($this->config['catalog'])['businessName'];
  $message="Sign in to your customer account at $name.\n\n$url\n\nThis link works once and expires in 15 minutes. Your first sign in creates your account automatically. If you did not request it, ignore this email.\n";
  try{$accepted=($transport??static fn($to,$subject,$text,$headers)=>mail($to,$subject,$text,$headers))($email,'Your store sign in link',$message,['From'=>$this->config['customer_accounts']['from'],'Content-Type'=>'text/plain; charset=UTF-8']);}catch(\Throwable $e){$accepted=false;}
  if(!$accepted){$s->execute('DELETE FROM customer_links WHERE tenant=? AND token_hash=?',[$s->tenant,$hash]);throw new ApiError('We could not send the sign in email. Please try again later or contact the store.',503);}
  return $reply;
 }
 private function link(mixed $value):array {
  $this->enabled();$token=Store::text($value,64);
  $link=preg_match('/^[a-f0-9]{64}$/D',$token)?($this->store->query('SELECT * FROM customer_links WHERE tenant=? AND token_hash=? AND expires_at>?',[$this->store->tenant,hash('sha256',$token),time()])[0]??null):null;
  if(!$link)throw new ApiError('This sign in link has expired or was already used. Request a new link.',410);return $link;
 }
 public function inspectLink(array $body):array {$link=$this->link($body['token']??null);return ['email'=>$link['email']];}
 public function verify(array $body):array {
  $s=$this->store;$session=bin2hex(random_bytes(32));$expires=time()+self::SESSION_SECONDS;
  $s->transaction(function()use($s,$body,$session,$expires){
   $link=$this->link($body['token']??null);
   $customer=$s->query('SELECT id FROM customers WHERE tenant=? AND email=?',[$s->tenant,$link['email']])[0]??null;
   $id=$customer['id']??('CUS-'.strtoupper(bin2hex(random_bytes(12))));
   if(!$customer)$s->execute('INSERT INTO customers(tenant,id,email,created_at,verified_at) VALUES(?,?,?,?,?)',[$s->tenant,$id,$link['email'],time(),time()]);
   // Each capability is consumed atomically with account creation and session rotation.
   $s->execute('DELETE FROM customer_links WHERE tenant=? AND email=?',[$s->tenant,$link['email']]);
   $s->execute('DELETE FROM customer_sessions WHERE tenant=? AND token_hash=?',[$s->tenant,hash('sha256',$this->cookieToken())]);
   $s->execute('INSERT INTO customer_sessions(tenant,token_hash,customer_id,expires_at) VALUES(?,?,?,?)',[$s->tenant,hash('sha256',$session),$id,$expires]);
  });
  $this->cookie($session,$expires);return ['ok'=>true];
 }
 public function logout():array {
  $this->store->execute('DELETE FROM customer_sessions WHERE tenant=? AND token_hash=?',[$this->store->tenant,hash('sha256',$this->cookieToken())]);
  $this->cookie('',time()-3600);return ['ok'=>true];
 }
 public function orders(string $customer,int $offset=0):array {
  $rows=$this->store->query('SELECT * FROM orders WHERE tenant=? AND customer_id=? ORDER BY created_at DESC,id DESC LIMIT 21 OFFSET '.max(0,$offset),[$this->store->tenant,$customer]);
  return ['orders'=>array_map(fn($o)=>$this->orderView($o),array_slice($rows,0,20)),'nextOffset'=>count($rows)>20?$offset+20:null];
 }
 private function orderView(array $o):array {
  $s=$this->store;
  return ['id'=>$o['id'],'status'=>$o['status'],'paymentStatus'=>$o['payment_status'],'createdAt'=>(int)$o['created_at'],'fulfillment'=>$o['fulfillment'],'fulfillmentMeta'=>Fulfillment::read($o),'orderLocation'=>$s->orderLocation($o),'deliveryAddress'=>$o['address'],'deliveryAddressId'=>$o['delivery_address_id'],'lines'=>json_decode($o['lines_json'],true),'discount'=>(int)$o['discount'],'deal'=>json_decode($o['deal_json'],true),'subtotal'=>(int)$o['subtotal'],'tax'=>(int)$o['tax'],'deliveryFee'=>(int)$o['delivery_fee'],'tip'=>(int)$o['tip'],'total'=>(int)$o['total'],'currency'=>$o['currency'],'driver'=>$o['driver_id']?['id'=>$o['driver_id'],'name'=>$s->query('SELECT name FROM drivers WHERE tenant=? AND id=?',[$s->tenant,$o['driver_id']])[0]['name']??'Driver']:null,'canReport'=>$o['fulfillment']==='delivery'&&$o['status']==='delivered'&&(bool)$o['driver_id'],'driverBlocked'=>(bool)CustomerDrivers::blocked($s,$o,$o['driver_id']??''),'report'=>$s->query('SELECT reason,details,created_at AS createdAt FROM customer_driver_reports WHERE tenant=? AND customer_id=? AND order_id=?',[$s->tenant,$o['customer_id'],$o['id']])[0]??null];
 }
 public function claim(string $customer,string $id,string $token):array {
  return $this->store->transaction(function()use($customer,$id,$token){
   $s=$this->store;$s->tracking($id,$token);$o=$s->get($id);
   if($o['customer_id']!==null&&$o['customer_id']!==$customer)throw new ApiError('This order belongs to another customer account.',409);
   if($o['customer_id']===null){
    $candidate=array_replace($o,['customer_id'=>$customer]);
    if($o['driver_id']&&in_array($o['status'],['placed','accepted','preparing','ready','out_for_delivery'],true))CustomerDrivers::assertAllowed($s,$candidate,$o['driver_id']);
    $s->execute('UPDATE orders SET customer_id=?,updated_at=? WHERE tenant=? AND id=?',[$customer,time(),$s->tenant,$id]);
   }
   (new DeliveryAddresses($s))->ordered($s->get($id));
   return $this->orderView($s->get($id));
  });
 }
}
