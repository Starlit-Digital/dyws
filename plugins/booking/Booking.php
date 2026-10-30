<?php
declare(strict_types=1);
namespace dyws\Plugins\Booking;
use dyws\{Store,ApiError};

/** Services share a named staff or room resource. Reservations serialize in SQLite. */
final class Booking {
 public function __construct(private array $config,private Store $store){
  $store->db->exec("CREATE TABLE IF NOT EXISTS appointments (tenant TEXT NOT NULL,id TEXT NOT NULL,request_key TEXT NOT NULL,fingerprint TEXT NOT NULL,service TEXT NOT NULL,starts_at INTEGER NOT NULL,ends_at INTEGER NOT NULL,customer_json TEXT NOT NULL,token_hash TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('confirmed','cancelled','completed')),created_at INTEGER NOT NULL,PRIMARY KEY(tenant,id),UNIQUE(tenant,request_key)); CREATE INDEX IF NOT EXISTS appointments_slots ON appointments(tenant,service,starts_at,ends_at,status)");
  $columns=array_column($store->query('PRAGMA table_info(appointments)'),'name');
  foreach(['resource'=>"TEXT NOT NULL DEFAULT 'main'",'service_name'=>"TEXT NOT NULL DEFAULT ''",'time_zone'=>"TEXT NOT NULL DEFAULT ''"] as $name=>$definition)if(!in_array($name,$columns,true))$store->db->exec("ALTER TABLE appointments ADD COLUMN $name $definition");
  $store->db->exec('CREATE INDEX IF NOT EXISTS appointments_resources ON appointments(tenant,resource,starts_at,ends_at,status)');
  if(!empty($config['demo_lockdown']))$store->execute('DELETE FROM appointments WHERE tenant=? AND created_at<?',[$store->tenant,time()-86400]);
 }
 private function settingsPath():string{return dirname($this->config['database']??$this->store->db->query('PRAGMA database_list')->fetch()['file']).'/booking-'.substr(hash('sha256',$this->store->tenant),0,16).'.json';}
 public function configuration():array{$s=$this->settings();return $s+['revision'=>hash('sha256',json_encode($s,JSON_THROW_ON_ERROR))];}
 public function configure(array $body):array {
  $path=$this->settingsPath();$lock=fopen($path.'.lock','c');if(!$lock)throw new ApiError('Booking settings are busy.',503);
  try{if(!flock($lock,LOCK_EX))throw new ApiError('Booking settings are busy.',503);
   return $this->store->transaction(function()use($path,$body):array{
   $current=$this->configuration();if(!hash_equals($current['revision'],Store::text($body['revision']??null,64)))throw new ApiError('Settings changed. Reload before saving.',409);
   $candidate=$body['settings']??null;if(!is_array($candidate))throw new ApiError('Provide booking settings.');
   // Validate before replacing the private configuration. Keep the same validation source.

   // A separate validation method keeps the live settings file untouched until validation completes.
   try{$valid=$this->validateSettings($candidate);}catch(ApiError $e){throw new ApiError($e->getMessage(),422);}
   $temporary=$path.'.'.bin2hex(random_bytes(6)).'.tmp';
   if(file_put_contents($temporary,json_encode($valid,JSON_THROW_ON_ERROR))===false)throw new ApiError('Unable to save settings.',503);
   chmod($temporary,0600);if(!rename($temporary,$path)){unlink($temporary);throw new ApiError('Unable to save settings.',503);}return $this->configuration();
   });
  }finally{flock($lock,LOCK_UN);fclose($lock);}
 }
 public function settings():array {
  $path=$this->settingsPath();$s=is_file($path)?json_decode(file_get_contents($path),true,32,JSON_THROW_ON_ERROR):($this->config['booking']??[]);return $this->validateSettings($s);
 }
 private function validateSettings(array $s):array {
  $zone=$s['timeZone']??'America/Edmonton';
  try{new \DateTimeZone($zone);}catch(\Throwable){throw new ApiError('Booking timezone needs attention.',503);}
  $services=$s['services']??[];if(!is_array($services)||!array_is_list($services)||count($services)>50)throw new ApiError('Booking services need attention.',503);
  $ids=[];foreach($services as &$v){
   if(!is_array($v)||!is_string($v['id']??null)||!preg_match('/^[a-z][a-z0-9-]{0,59}$/D',$v['id'])||isset($ids[$v['id']])||!is_int($v['duration']??null)||$v['duration']<15||$v['duration']>480||$v['duration']%15)throw new ApiError('Booking services need attention.',503);
   $ids[$v['id']]=true;$resource=$v['resource']??'main';if(!is_string($resource)||!preg_match('/^[a-z][a-z0-9-]{0,59}$/D',$resource))throw new ApiError('Choose a valid booking resource.',503);$v=['id'=>$v['id'],'name'=>Store::text($v['name']??null,120),'duration'=>$v['duration'],'resource'=>$resource];
  }unset($v);
  $open=$s['openMinute']??540;$close=$s['closeMinute']??1020;$days=$s['days']??[1,2,3,4,5,6];
  if(!is_int($open)||!is_int($close)||$open<0||$close>1440||$close<=$open||$open%15||$close%15||!is_array($days)||!array_is_list($days)||array_filter($days,fn($d)=>!is_int($d)||$d<1||$d>7))throw new ApiError('Booking hours need attention.',503);
  return ['timeZone'=>$zone,'services'=>$services,'openMinute'=>$open,'closeMinute'=>$close,'days'=>$days,'demo'=>!empty($this->config['demo_lockdown'])];
 }
 private function service(string $id):array {foreach($this->settings()['services'] as $s)if($s['id']===$id)return $s;throw new ApiError('Choose an available service.');}
 private function occupied(string $resource,int $start,int $end):bool{return (bool)$this->store->query("SELECT id FROM appointments WHERE tenant=? AND resource=? AND status='confirmed' AND starts_at<? AND ends_at>? LIMIT 1",[$this->store->tenant,$resource,$end,$start]);}
 public function availability(array $body):array {
  $id=Store::text($body['serviceId']??null,60);$service=$this->service($id);$s=$this->settings();$date=Store::text($body['date']??null,10);$tz=new \DateTimeZone($s['timeZone']);
  $day=\DateTimeImmutable::createFromFormat('!Y-m-d',$date,$tz);$today=new \DateTimeImmutable('today',$tz);
  if(!$day||$day->format('Y-m-d')!==$date||$day<$today||$day>$today->modify('+90 days'))throw new ApiError('Choose a date within the next 90 days.');
  $slots=[];if(in_array((int)$day->format('N'),$s['days'],true))for($m=$s['openMinute'];$m+$service['duration']<=$s['closeMinute'];$m+=15){
   $clock=sprintf('%02d:%02d',intdiv($m,60),$m%60);
   try{$at=\dyws\LocalTime::instant(['date'=>$date,'time'=>$clock],$s['timeZone']);}catch(ApiError){continue;}
   $start=$at->getTimestamp();$end=$start+$service['duration']*60;
   if($start<time()+1800||$this->occupied($service['resource'],$start,$end))continue;
   $slots[]=['startsAt'=>$start,'endsAt'=>$end,'label'=>$clock];
  }
  return ['date'=>$date,'serviceId'=>$id,'timeZone'=>$s['timeZone'],'slots'=>$slots];
 }
 public function reserve(array $body):array {
  if(($body['acknowledged']??false)!==true)throw new ApiError('Review and confirm your appointment.');
  $key=Store::text($body['idempotencyKey']??null,80);if(!preg_match('/^[A-Za-z0-9-]{16,80}$/D',$key))throw new ApiError('Invalid request key.');
  $id=Store::text($body['serviceId']??null,60);$start=$body['startsAt']??null;if(!is_int($start)||$start<0||$start>time()+92*86400)throw new ApiError('Choose an available time.');
  $customer=!empty($this->config['demo_lockdown'])?['name'=>'Demo Customer','phone'=>'7805550142']:($body['customer']??[]);
  if(!is_array($customer))throw new ApiError('Provide customer contact details.');
  $customer=['name'=>Store::text($customer['name']??null,100),'phone'=>Store::text($customer['phone']??null,30)];if(!preg_match('/^[0-9+() .-]{7,30}$/D',$customer['phone']))throw new ApiError('Enter a phone number.');
  $fingerprint=hash('sha256',json_encode([$id,$start,$customer],JSON_THROW_ON_ERROR));
  return $this->store->transaction(function()use($key,$fingerprint,$id,$start,$customer){
   $old=$this->store->query('SELECT * FROM appointments WHERE tenant=? AND request_key=?',[$this->store->tenant,$key])[0]??null;
   if($old){if(!hash_equals($old['fingerprint'],$fingerprint))throw new ApiError('Request key was already used.',409);return $this->receipt($old,$key);}
   if(!empty($this->config['demo_lockdown'])&&$this->store->query('SELECT count(*) AS n FROM appointments WHERE tenant=?',[$this->store->tenant])[0]['n']>=500)throw new ApiError('Demo appointment limit reached.',429);
   $service=$this->service($id);
   $date=(new \DateTimeImmutable('@'.$start))->setTimezone(new \DateTimeZone($this->settings()['timeZone']))->format('Y-m-d');
   if(!in_array($start,array_column($this->availability(['serviceId'=>$id,'date'=>$date])['slots'],'startsAt'),true))throw new ApiError('This time is no longer available. Choose another time.',409);
   $appointment='APT-'.strtoupper(bin2hex(random_bytes(6)));$token=$this->token($appointment,$key);
   $this->store->execute("INSERT INTO appointments(tenant,id,request_key,fingerprint,service,starts_at,ends_at,customer_json,token_hash,status,created_at,resource,service_name,time_zone) VALUES(?,?,?,?,?,?,?,?,?,'confirmed',?,?,?,?)",[$this->store->tenant,$appointment,$key,$fingerprint,$id,$start,$start+$service['duration']*60,json_encode($customer,JSON_THROW_ON_ERROR),hash('sha256',$token),time(),$service['resource'],$service['name'],$this->settings()['timeZone']]);
   return $this->receipt($this->store->query('SELECT * FROM appointments WHERE tenant=? AND id=?',[$this->store->tenant,$appointment])[0],$key);
  });
 }
 private function token(string $id,string $key):string{return hash_hmac('sha256','booking|'.$this->store->tenant.'|'.$id.'|'.$key,$this->config['tracking_secret']);}
 private function receipt(array $r,string $key):array{return ['id'=>$r['id'],'serviceId'=>$r['service'],'startsAt'=>(int)$r['starts_at'],'endsAt'=>(int)$r['ends_at'],'status'=>$r['status'],'serviceName'=>$r['service_name']?:$r['service'],'timeZone'=>$r['time_zone']?:$this->settings()['timeZone'],'cancellationToken'=>$this->token($r['id'],$key),'demo'=>!empty($this->config['demo_lockdown'])];}
 public function listing():array{return ['appointments'=>$this->store->query('SELECT id,service,service_name,resource,time_zone,starts_at,ends_at,status,customer_json FROM appointments WHERE tenant=? ORDER BY starts_at DESC LIMIT 200',[$this->store->tenant]),'settings'=>$this->settings()];}
 public function change(array $body,bool $manager=false):array {
  $id=Store::text($body['id']??null,40);$status=$manager?($body['status']??'cancelled'):'cancelled';if(!in_array($status,['cancelled','completed'],true))throw new ApiError('Choose a valid appointment status.');
  return $this->store->transaction(function()use($id,$status,$body,$manager){
   $r=$this->store->query('SELECT * FROM appointments WHERE tenant=? AND id=?',[$this->store->tenant,$id])[0]??null;
   if(!$r||(!$manager&&!hash_equals($r['token_hash'],hash('sha256',Store::text($body['token']??'',64,false)))))throw new ApiError('Appointment not found.',404);
   if($r['status']===$status)return ['id'=>$id,'status'=>$status];
   if($status==='completed'&&(int)$r['ends_at']>time())throw new ApiError('Complete an appointment after its end time.',409);
   if($r['status']!=='confirmed'||(!$manager&&(int)$r['starts_at']<=time()))throw new ApiError('This appointment can no longer be changed.',409);
   $this->store->execute('UPDATE appointments SET status=? WHERE tenant=? AND id=?',[$status,$this->store->tenant,$id]);return ['id'=>$id,'status'=>$status];
  });
 }
}
