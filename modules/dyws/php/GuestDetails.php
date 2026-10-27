<?php
declare(strict_types=1);
namespace dyws;

/** A browser capability for checkout details only. It grants no order or payment access. */
final class GuestDetails {
 public const LIFETIME=180*86400;
 private string $cookieName;
 private string $cookiePath;
 public function __construct(private Store $store,private array $config){
  $this->cookiePath=rtrim(parse_url($config['public_base_url']??'',PHP_URL_PATH)?:'','/').'/';
  $this->cookieName='dyws_guest_'.substr(hash('sha256',$store->tenant.'|'.$this->cookiePath),0,16);
 }
 public function prune():void{$this->store->execute('DELETE FROM guest_details WHERE tenant=? AND expires_at<=?',[$this->store->tenant,time()]);}
 private function token():string{$token=$_COOKIE[$this->cookieName]??'';return is_string($token)&&preg_match('/^[a-f0-9]{64}$/D',$token)?$token:'';}
 private function profile():?array {
  $token=$this->token();if($token==='')return null;
  return $this->store->query('SELECT * FROM guest_details WHERE tenant=? AND token_hash=? AND expires_at>?',[$this->store->tenant,hash('sha256',$token),time()])[0]??null;
 }
 private function cookie(string $token,int $expires):void {
  setcookie($this->cookieName,$token,['expires'=>$expires,'path'=>$this->cookiePath,'secure'=>parse_url($this->config['public_base_url']??'',PHP_URL_SCHEME)==='https'||(!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off'),'httponly'=>true,'samesite'=>'Lax']);
 }
 /** The custom header requires a CORS preflight. This API never permits cross origin access. */
 public function guard():void {
  if(($_SERVER['HTTP_X_DYWS_GUEST']??'')!=='1'||($_SERVER['HTTP_SEC_FETCH_SITE']??'')==='cross-site')throw new ApiError('Open checkout on this website to manage saved details.',403);
  $origin=$_SERVER['HTTP_ORIGIN']??null;
  if($origin!==null){
   $scheme=(!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off')?'https':'http';
   $actual=$scheme.'://'.($_SERVER['HTTP_HOST']??'');
   if(!hash_equals($actual,$origin))throw new ApiError('Open checkout on this website to manage saved details.',403);
  }
 }
 public function read():array {
  $p=$this->profile();if(!$p)return ['profileId'=>null,'addresses'=>[]];
  $rows=$this->store->query('SELECT id,label,address_json FROM guest_addresses WHERE tenant=? AND profile_id=? ORDER BY created_at,id',[$this->store->tenant,$p['id']]);
  return ['profileId'=>$p['id'],'customer'=>['name'=>$p['customer_name'],'phone'=>$p['customer_phone'],'email'=>$p['customer_email']],'defaultAddressId'=>$p['default_address_id'],'expiresAt'=>(int)$p['expires_at'],'addresses'=>array_map(fn($r)=>['id'=>$r['id'],'label'=>$r['label'],'addressDetails'=>json_decode($r['address_json'],true,512,JSON_THROW_ON_ERROR)],$rows)];
 }
 public function manage(array $body):array {
  $action=$body['action']??'';if(!in_array($action,['forget','remove','default'],true))throw new ApiError('Choose a saved details action.');
  $this->store->transaction(function()use($body,$action){
   $p=$this->profile();if(!$p)return;
   if($action==='forget'){$this->store->execute('DELETE FROM guest_details WHERE tenant=? AND id=?',[$this->store->tenant,$p['id']]);return;}
   $id=Store::text($body['addressId']??null,32);
   $rows=$this->store->query('SELECT id FROM guest_addresses WHERE tenant=? AND profile_id=? AND id=?',[$this->store->tenant,$p['id'],$id]);
   if(!$rows)throw new ApiError('That saved address is no longer available.',404);
   if($action==='remove'){
    $this->store->execute('DELETE FROM guest_addresses WHERE tenant=? AND profile_id=? AND id=?',[$this->store->tenant,$p['id'],$id]);
    if($p['default_address_id']===$id)$this->store->execute('UPDATE guest_details SET default_address_id=NULL WHERE tenant=? AND id=?',[$this->store->tenant,$p['id']]);
   }else $this->store->execute('UPDATE guest_details SET default_address_id=? WHERE tenant=? AND id=?',[$id,$this->store->tenant,$p['id']]);
  });
  if($action==='forget')$this->cookie('',time()-3600);
  return $this->read();
 }
 public function validatePreference(mixed $preference):?array {
  if($preference===null)return null;
  if(!is_array($preference)||!is_bool($preference['enabled']??null))throw new ApiError('Choose whether to remember your details.');
  return ['enabled'=>$preference['enabled'],'profileId'=>Store::text($preference['profileId']??'',32,false),'addressId'=>Store::text($preference['addressId']??'',32,false),'label'=>$preference['enabled']?Store::text($preference['label']??'Home',40):'Home','default'=>($preference['default']??false)===true];
 }
 /** Called in the order transaction, only for a newly committed order. */
 public function ordered(array $order,?array $preference):?array {
  $p=$this->profile();$token=$this->token();$save=$preference&&$preference['enabled'];
  // An old tab cannot silently recreate details after Forget or expiry.
  if($save&&$preference['profileId']!==''&&$preference['profileId']!==($p['id']??null))$save=false;
  if(!$p&&!$save)return null;
  $expires=(int)$order['created_at']+self::LIFETIME;
  if(!$p){
   $token=bin2hex(random_bytes(32));$p=['id'=>bin2hex(random_bytes(16)),'default_address_id'=>null];
   $this->store->execute('INSERT INTO guest_details(tenant,id,token_hash,customer_name,customer_phone,customer_email,expires_at) VALUES(?,?,?,?,?,?,?)',[$this->store->tenant,$p['id'],hash('sha256',$token),$order['customer_name'],$order['customer_phone'],$order['customer_email'],$expires]);
  }
  $this->store->execute('UPDATE guest_details SET expires_at=? WHERE tenant=? AND id=?',[$expires,$this->store->tenant,$p['id']]);
  if($save){
   $this->store->execute('UPDATE guest_details SET customer_name=?,customer_phone=?,customer_email=? WHERE tenant=? AND id=?',[$order['customer_name'],$order['customer_phone'],$order['customer_email'],$this->store->tenant,$p['id']]);
   $address=json_decode($order['address_json'],true,512,JSON_THROW_ON_ERROR);
   if($order['fulfillment']==='delivery'&&!empty($address['line1'])){
    $rows=$this->store->query('SELECT * FROM guest_addresses WHERE tenant=? AND profile_id=?',[$this->store->tenant,$p['id']]);$id='';
    foreach($rows as $row)if($row['id']===$preference['addressId']){$id=$row['id'];break;}
    // Removed addresses stay removed when a stale checkout is submitted.
    if($preference['addressId']!==''&&$id==='')return ['token'=>$token,'expires'=>$expires];
    if($id==='')foreach($rows as $row)if($this->addressKey(json_decode($row['address_json'],true))===$this->addressKey($address)){$id=$row['id'];break;}
    if($id===''&&count($rows)>=10)throw new ApiError('You have 10 saved addresses. Remove one or turn off remembering for this order.');
    $id=$id?:bin2hex(random_bytes(16));
    $this->store->execute('INSERT INTO guest_addresses(tenant,profile_id,id,label,address_json,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(tenant,profile_id,id) DO UPDATE SET label=excluded.label,address_json=excluded.address_json',[$this->store->tenant,$p['id'],$id,$preference['label'],json_encode($address,JSON_THROW_ON_ERROR),time()]);
    $this->store->execute('UPDATE guest_addresses SET delivery_address_id=? WHERE tenant=? AND profile_id=? AND id=?',[$order['delivery_address_id'],$this->store->tenant,$p['id'],$id]);
    if($preference['default'])$this->store->execute('UPDATE guest_details SET default_address_id=? WHERE tenant=? AND id=?',[$id,$this->store->tenant,$p['id']]);
    elseif($p['default_address_id']===$id)$this->store->execute('UPDATE guest_details SET default_address_id=NULL WHERE tenant=? AND id=?',[$this->store->tenant,$p['id']]);
   }
  }
  return ['token'=>$token,'expires'=>$expires];
 }
 private function addressKey(array $address):string{return mb_strtolower(preg_replace('/\s+/u',' ',trim(implode('|',$address))));}
 public function renewCookie(?array $renewal):void{if($renewal)$this->cookie($renewal['token'],$renewal['expires']);}
}
