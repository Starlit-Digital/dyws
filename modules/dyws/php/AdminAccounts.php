<?php
declare(strict_types=1);
namespace StarlitGo;

/** Private account overrides preserve the deployment config and never return hashes. */
final class AdminAccounts {
 private string $path;
 public function __construct(private array $config){$this->path=dirname($config['database']).'/accounts-'.substr(hash('sha256',$config['tenant']),0,16).'.json';}
 private function read():array {return is_file($this->path)?json_decode(file_get_contents($this->path),true,64,JSON_THROW_ON_ERROR):['drivers'=>[]];}
 public function effective():array {
  $saved=$this->read();$config=$this->config;
  if(isset($saved['manager_password_hash']))$config['manager_password_hash']=$saved['manager_password_hash'];
  $config['drivers']=array_replace($config['drivers']??[],$saved['drivers']??[]);
  return $config;
 }
 private function locked(callable $fn){
  $lock=fopen($this->path.'.lock','c');if(!$lock||!flock($lock,LOCK_EX))throw new ApiError('Account settings are busy.',503);
  try{return $fn();}finally{flock($lock,LOCK_UN);fclose($lock);}
 }
 private static function password($value):string {
  if(!is_string($value)||strlen($value)<12||strlen($value)>72||str_contains($value,"\0"))throw new ApiError('Use a password between 12 and 72 bytes.');
  return $value;
 }
 public function summary(Store $store):array {
  $drivers=$this->effective()['drivers'];$out=[];
  foreach($drivers as $id=>$driver){$count=$store->query("SELECT count(*) AS n FROM orders WHERE tenant=? AND driver_id=? AND status NOT IN ('delivered','completed','cancelled')",[$store->tenant,$id])[0]['n'];$out[]=['id'=>$id,'name'=>$driver['name'],'active'=>$driver['active']??true,'activeOrders'=>(int)$count];}
  return ['drivers'=>$out,'revision'=>hash('sha256',json_encode($drivers,JSON_THROW_ON_ERROR))];
 }
 public function saveDriver(Store $store,array $body):array {
  return $this->locked(function()use($store,$body){
   $summary=$this->summary($store);if(!is_string($body['revision']??null)||!hash_equals($summary['revision'],$body['revision']))throw new ApiError('Drivers changed. Reload the list before saving.',409);
   $id=$body['id']??null;if(!is_string($id)||!preg_match('/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/',$id))throw new ApiError('Use letters, numbers and underscores for the driver ID.');
   $name=Store::text($body['name']??null,120);$active=$body['active']??null;if(!is_bool($active))throw new ApiError('Choose whether the driver is active.');
   $drivers=$this->effective()['drivers'];$existing=$drivers[$id]??null;
   if(($body['create']??false)===true&&$existing)throw new ApiError('That driver ID already exists. Choose another ID or edit the existing driver.',409);
   if(!$existing&&count($drivers)>=200)throw new ApiError('This demo supports up to 200 drivers.');
   if(!$active&&$store->query("SELECT id FROM orders WHERE tenant=? AND driver_id=? AND status NOT IN ('delivered','completed','cancelled') LIMIT 1",[$store->tenant,$id]))throw new ApiError('Reassign or finish this driver’s active orders before deactivating them.',409);
   $password=$body['password']??'';if(!is_string($password))throw new ApiError('Invalid password.');
   if(!$existing||$password!=='')$hash=password_hash(self::password($password),PASSWORD_DEFAULT);else $hash=$existing['password_hash'];
   $saved=$this->read();$saved['drivers'][$id]=['name'=>$name,'active'=>$active,'password_hash'=>$hash];Catalog::write($this->path,$saved);
   if(!$active||$password!=='')$store->execute("DELETE FROM sessions WHERE tenant=? AND role='driver' AND subject=?",[$store->tenant,$id]);
   return $this->summary($store);
  });
 }
 public function changePassword(Store $store,array $body):array {
  return $this->locked(function()use($store,$body){
   $current=$body['currentPassword']??'';if(!is_string($current)||strlen($current)>200||!password_verify($current,$this->effective()['manager_password_hash']))throw new ApiError('The current password is incorrect.',422);
   $next=self::password($body['newPassword']??null);if($next!==($body['confirmPassword']??null))throw new ApiError('The new passwords do not match.');
   $saved=$this->read();$saved['manager_password_hash']=password_hash($next,PASSWORD_DEFAULT);Catalog::write($this->path,$saved);
   $store->execute("DELETE FROM sessions WHERE tenant=? AND role='manager'",[$store->tenant]);return ['ok'=>true,'signInRequired'=>true];
  });
 }
 public function login(Store $store,array $body):array {
  return $this->locked(function()use($store,$body){
   $config=$this->effective();$role=$body['role']??'';$password=$body['password']??'';$subject=$role==='manager'?'manager':($body['driverId']??'');
   if(!is_string($role)||!is_string($subject))throw new ApiError('Incorrect sign in details.',401);
   $driver=$config['drivers'][$subject]??null;$hash=$role==='manager'?($config['manager_password_hash']??''):($driver['password_hash']??'');
   if(!in_array($role,['manager','driver'],true)||($role==='driver'&&(!$driver||!($driver['active']??true)))||!is_string($password)||strlen($password)>200||!password_verify($password,$hash?:'$2y$10$invalid'))throw new ApiError('Incorrect sign in details.',401);
   $token=bin2hex(random_bytes(32));$store->execute('INSERT INTO sessions(token_hash,tenant,role,subject,expires_at) VALUES(?,?,?,?,?)',[hash('sha256',$token),$store->tenant,$role,$subject,time()+28800]);$store->execute('DELETE FROM sessions WHERE expires_at<?',[time()]);
   return ['token'=>$token,'role'=>$role,'subject'=>$subject,'expiresAt'=>time()+28800];
  });
 }
 public function assign(Store $store,string $orderId,string $driverId):void {
  $this->locked(function()use($store,$orderId,$driverId){$driver=$this->effective()['drivers'][$driverId]??null;if(!$driver||!($driver['active']??true))throw new ApiError('Choose an active driver.');$store->assign($orderId,$driverId);});
 }
}
