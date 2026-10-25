<?php
declare(strict_types=1);
namespace dyws;

/** SQLite accounts, with a one-time import of legacy private JSON credentials. */
final class AdminAccounts {
 public const PROFILE_ICONS=['car','suv','pickup','van','motorcycle','bicycle'];
 public const VEHICLE_COLORS=['Black','Charcoal','Grey','Silver','White','Pearl','Ivory','Cream','Beige','Tan','Champagne','Gold','Bronze','Brown','Copper','Red','Burgundy','Maroon','Orange','Yellow','Lime','Green','Dark green','Teal','Turquoise','Blue','Navy','Sky blue','Purple','Lavender','Pink','Rose'];
 private string $path;
 private ?\PDO $db=null;
 public function __construct(private array $config){$this->path=dirname($config['database']).'/accounts-'.substr(hash('sha256',$config['tenant']),0,16).'.json';}
 private function database():\PDO {
  if($this->db)return $this->db;
  $db=new \PDO('sqlite:'.$this->config['database'],null,null,[\PDO::ATTR_ERRMODE=>\PDO::ERRMODE_EXCEPTION,\PDO::ATTR_DEFAULT_FETCH_MODE=>\PDO::FETCH_ASSOC]);
  $db->exec('PRAGMA busy_timeout=5000');$db->exec(file_get_contents(__DIR__.'/accounts.sql'));
  $db->exec('BEGIN IMMEDIATE');
  try{
   $columns=array_column($db->query('PRAGMA table_info(drivers)')->fetchAll(),'name');
   if(!in_array('profile_icon',$columns,true))$db->exec("ALTER TABLE drivers ADD COLUMN profile_icon TEXT NOT NULL DEFAULT 'car'");
   foreach(['vehicle_type','vehicle_color'] as $column)if(!in_array($column,$columns,true))$db->exec("ALTER TABLE drivers ADD COLUMN $column TEXT NOT NULL DEFAULT ''");
   $check=$db->prepare('SELECT 1 FROM account_migrations WHERE tenant=?');$check->execute([$this->config['tenant']]);
   if(!$check->fetchColumn()){
    $saved=is_file($this->path)?json_decode(file_get_contents($this->path),true,64,JSON_THROW_ON_ERROR):[];
    $drivers=array_replace($this->config['drivers']??[],$saved['drivers']??[]);
    $insert=$db->prepare('INSERT INTO drivers(tenant,id,name,password_hash,active) VALUES(?,?,?,?,?)');
    foreach($drivers as $id=>$driver)$insert->execute([$this->config['tenant'],$id,$driver['name'],$driver['password_hash'],($driver['active']??true)?1:0]);
    $hash=$saved['manager_password_hash']??$this->config['manager_password_hash']??null;
    if($hash){$insert=$db->prepare('INSERT INTO admin_credentials(tenant,password_hash) VALUES(?,?)');$insert->execute([$this->config['tenant'],$hash]);}
    $insert=$db->prepare('INSERT INTO account_migrations(tenant,completed_at) VALUES(?,?)');$insert->execute([$this->config['tenant'],time()]);
   }
   $db->exec('COMMIT');
  }catch(\Throwable $e){$db->exec('ROLLBACK');throw $e;}
  chmod($this->config['database'],0600);
  return $this->db=$db;
 }
 public function effective():array {
  $db=$this->database();$config=$this->config;$config['drivers']=[];
  $query=$db->prepare('SELECT id,name,password_hash,active,vehicle_type AS vehicleType,vehicle_color AS vehicleColor,profile_icon AS profileIcon FROM drivers WHERE tenant=? ORDER BY id');$query->execute([$config['tenant']]);
  foreach($query as $row){$id=$row['id'];unset($row['id']);$row['active']=(bool)$row['active'];$row['profileIcon']=self::profileIcon($row['profileIcon'],false);$config['drivers'][$id]=$row;}
  $query=$db->prepare('SELECT password_hash FROM admin_credentials WHERE tenant=?');$query->execute([$config['tenant']]);
  $config['manager_password_hash']=$query->fetchColumn()?:'';
  return $config;
 }
 private function locked(Store $store,callable $fn,bool $transaction=false){
  // Keep credential changes, session revocation and login serialized.
  $lock=fopen($this->path.'.lock','c');if(!$lock||!flock($lock,LOCK_EX))throw new ApiError('Account settings are busy.',503);
  try{$this->database();$this->db=$store->db;return $transaction?$store->transaction($fn):$fn();}finally{flock($lock,LOCK_UN);fclose($lock);}
 }
 private static function password($value):string {
  if(!is_string($value)||strlen($value)<12||strlen($value)>72||str_contains($value,"\0"))throw new ApiError('Use a password between 12 and 72 bytes.');
  return $value;
 }
 public function summary(Store $store):array {
  $drivers=$this->effective()['drivers'];$out=[];
  foreach($drivers as $id=>$driver){$count=$store->query("SELECT count(*) AS n FROM orders WHERE tenant=? AND driver_id=? AND status NOT IN ('delivered','completed','cancelled')",[$store->tenant,$id])[0]['n'];$out[]=['id'=>$id,'name'=>$driver['name'],'vehicleType'=>$driver['vehicleType'],'vehicleColor'=>$driver['vehicleColor'],'profileIcon'=>$driver['profileIcon'],'active'=>$driver['active']??true,'activeOrders'=>(int)$count];}
  return ['drivers'=>$out,'revision'=>hash('sha256',json_encode($drivers,JSON_THROW_ON_ERROR))];
 }
 public function saveDriver(Store $store,array $body):array {
  return $this->locked($store,function()use($store,$body){
   $summary=$this->summary($store);if(!is_string($body['revision']??null)||!hash_equals($summary['revision'],$body['revision']))throw new ApiError('Drivers changed. Reload the list before saving.',409);
   $id=$body['id']??null;if(!is_string($id)||!preg_match('/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/',$id))throw new ApiError('Use letters, numbers and underscores for the driver ID.');
   $name=Store::text($body['name']??null,120);$active=$body['active']??null;if(!is_bool($active))throw new ApiError('Choose whether the driver is active.');
   $drivers=$this->effective()['drivers'];$existing=$drivers[$id]??null;
   $profileIcon=self::profileIcon($body['profileIcon']??$existing['profileIcon']??'car');
   // Vehicle details belong to the driver's own profile, including during account edits.
   $vehicleType=$existing['vehicleType']??'';$vehicleColor=$existing['vehicleColor']??'';
   if(($body['create']??false)===true&&$existing)throw new ApiError('That driver ID already exists. Choose another ID or edit the existing driver.',409);
   if(!$existing&&count($drivers)>=200)throw new ApiError('This installation supports up to 200 drivers.');
   if(!$active&&$store->query("SELECT id FROM orders WHERE tenant=? AND driver_id=? AND status NOT IN ('delivered','completed','cancelled') LIMIT 1",[$store->tenant,$id]))throw new ApiError('Reassign or finish this driver’s active orders before deactivating them.',409);
   $password=$body['password']??'';if(!is_string($password))throw new ApiError('Invalid password.');
   if(!$existing||$password!=='')$hash=password_hash(self::password($password),PASSWORD_DEFAULT);else $hash=$existing['password_hash'];
   $store->execute('INSERT INTO drivers(tenant,id,name,password_hash,active,vehicle_type,vehicle_color,profile_icon) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(tenant,id) DO UPDATE SET name=excluded.name,password_hash=excluded.password_hash,active=excluded.active,vehicle_type=excluded.vehicle_type,vehicle_color=excluded.vehicle_color,profile_icon=excluded.profile_icon',[$store->tenant,$id,$name,$hash,$active?1:0,$vehicleType,$vehicleColor,$profileIcon]);
   if(!$active||$password!=='')$store->execute("DELETE FROM sessions WHERE tenant=? AND role='driver' AND subject=?",[$store->tenant,$id]);
   return $this->summary($store);
  },true);
 }
 public static function profileIcon($value,bool $strict=true):string {
  if(is_string($value)&&in_array($value,self::PROFILE_ICONS,true))return $value;
  if(!$strict)return 'car';
  throw new ApiError('Choose one of the available driver icons.');
 }
 public function profile(Store $store,string $id):array {
  $drivers=$this->effective()['drivers'];$driver=$drivers[$id]??null;
  if(!$driver||!$driver['active'])throw new ApiError('Driver profile is unavailable.',403);
  $profile=['id'=>$id,'name'=>$driver['name'],'vehicleType'=>$driver['vehicleType'],'vehicleColor'=>$driver['vehicleColor'],'profileIcon'=>$driver['profileIcon']];
  return $profile+['revision'=>hash('sha256',json_encode($profile,JSON_THROW_ON_ERROR))];
 }
 public function saveProfile(Store $store,string $id,array $body):array {
  return $this->locked($store,function()use($store,$id,$body){
   $profile=$this->profile($store,$id);
   if(!is_string($body['revision']??null)||!hash_equals($profile['revision'],$body['revision']))throw new ApiError('Your profile changed. Reload it before saving.',409);
   $icon=self::profileIcon($body['profileIcon']??null);
   $vehicleType=array_key_exists('vehicleType',$body)?Store::text($body['vehicleType'],60,false):$profile['vehicleType'];
   $vehicleColor=$profile['vehicleColor'];
   if(array_key_exists('vehicleColor',$body)){
    $vehicleColor=Store::text($body['vehicleColor'],60,false);
    // Retain a legacy free text colour until its owner chooses a swatch or clears it.
    if($vehicleColor!==''&&$vehicleColor!==$profile['vehicleColor']&&!in_array($vehicleColor,self::VEHICLE_COLORS,true))throw new ApiError('Choose one of the available vehicle colours.');
   }
   $store->execute('UPDATE drivers SET profile_icon=?,vehicle_type=?,vehicle_color=? WHERE tenant=? AND id=? AND active=1',[$icon,$vehicleType,$vehicleColor,$store->tenant,$id]);
   return $this->profile($store,$id);
  },true);
 }
 public function changePassword(Store $store,array $body):array {
  return $this->locked($store,function()use($store,$body){
   $current=$body['currentPassword']??'';if(!is_string($current)||strlen($current)>200||!password_verify($current,$this->effective()['manager_password_hash']))throw new ApiError('The current password is incorrect.',422);
   $next=self::password($body['newPassword']??null);if($next!==($body['confirmPassword']??null))throw new ApiError('The new passwords do not match.');
   $store->execute('UPDATE admin_credentials SET password_hash=? WHERE tenant=?',[password_hash($next,PASSWORD_DEFAULT),$store->tenant]);
   $store->execute("DELETE FROM sessions WHERE tenant=? AND role='manager'",[$store->tenant]);return ['ok'=>true,'signInRequired'=>true];
  },true);
 }
 public function login(Store $store,array $body):array {
  if(!empty($this->config['required_plugins'])){
   $policies=$store->plugins??new Plugins($this->config,$this->config['plugins_path']??null,$store);
   $policies->validate('auth.validating',$body);
  }
  return $this->locked($store,function()use($store,$body){
   $config=$this->effective();$role=$body['role']??'';$password=$body['password']??'';$subject=$role==='manager'?'manager':($body['driverId']??'');
   if(!is_string($role)||!is_string($subject))throw new ApiError('Incorrect sign in details.',401);
   $driver=$config['drivers'][$subject]??null;$hash=$role==='manager'?($config['manager_password_hash']??''):($driver['password_hash']??'');
   if(!in_array($role,['manager','driver'],true)||($role==='driver'&&(!$driver||!($driver['active']??true)))||!is_string($password)||strlen($password)>200||!password_verify($password,$hash?:'$2y$10$invalid'))throw new ApiError('Incorrect sign in details.',401);
   $token=bin2hex(random_bytes(32));$store->execute('INSERT INTO sessions(token_hash,tenant,role,subject,expires_at) VALUES(?,?,?,?,?)',[hash('sha256',$token),$store->tenant,$role,$subject,time()+28800]);$store->execute('DELETE FROM sessions WHERE expires_at<?',[time()]);
   return ['token'=>$token,'role'=>$role,'subject'=>$subject,'expiresAt'=>time()+28800];
  },true);
 }
 public function createRun(Store $store,array $body):array {
  return $this->locked($store,function()use($store,$body){$id=Store::text($body['driverId']??null,80);$driver=$this->effective()['drivers'][$id]??null;if(!$driver||!($driver['active']??true))throw new ApiError('Choose an active driver.');if(!is_array($body['orderIds']??null))throw new ApiError('Choose the delivery orders.');return (new DeliveryRuns($store))->create($id,$body['orderIds'],Store::text($body['idempotencyKey']??null,80));});
 }
 public function assign(Store $store,string $orderId,string $driverId):void {
  $this->locked($store,function()use($store,$orderId,$driverId){$driver=$this->effective()['drivers'][$driverId]??null;if(!$driver||!($driver['active']??true))throw new ApiError('Choose an active driver.');$store->assign($orderId,$driverId);});
 }
}
