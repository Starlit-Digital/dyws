<?php
declare(strict_types=1);
namespace dyws\Plugins\Nominatim;
use dyws\{ApiError,Catalog};

/** Optional address suggestions. Never participates in order validation or pricing. */
final class AddressLookup {
 private string $path; private string $key;
 public function __construct(private array $config,private $transport=null){
  $this->path=dirname($config['database']).'/nominatim-'.substr(hash('sha256',$config['tenant']),0,16).'.json';
  $this->key=hash_hkdf('sha256',$config['tracking_secret'],32,'dyws-nominatim:'.$config['tenant']);
 }
 private function demo():bool{return !empty($this->config['demo_lockdown'])||in_array('demo-lockdown',$this->config['required_plugins']??[],true);}
 private function read():array {
  if(!is_file($this->path))return ['enabled'=>false,'endpoint'=>'','username'=>'','password'=>''];
  try{
   $d=json_decode(file_get_contents($this->path),true,16,JSON_THROW_ON_ERROR);
   $plain=openssl_decrypt(base64_decode($d['ciphertext'],true),'aes-256-gcm',$this->key,OPENSSL_RAW_DATA,base64_decode($d['iv'],true),base64_decode($d['tag'],true),$this->config['tenant']);
   if($plain===false)throw new \RuntimeException();
   return json_decode($plain,true,16,JSON_THROW_ON_ERROR);
  }catch(\Throwable){throw new ApiError('Address lookup settings are unavailable.',503);}
 }
 private function write(array $data):void {
  $iv=random_bytes(12);$tag='';$cipher=openssl_encrypt(json_encode($data,JSON_THROW_ON_ERROR),'aes-256-gcm',$this->key,OPENSSL_RAW_DATA,$iv,$tag,$this->config['tenant']);
  if($cipher===false)throw new ApiError('Could not save address lookup settings.',503);
  Catalog::write($this->path,['iv'=>base64_encode($iv),'tag'=>base64_encode($tag),'ciphertext'=>base64_encode($cipher)]);
 }
 private function change(callable $fn):array {
  $lock=fopen($this->path.'.lock','c');if(!$lock)throw new ApiError('Address lookup settings are busy.',503);
  try{if(!flock($lock,LOCK_EX))throw new ApiError('Address lookup settings are busy.',503);$this->write($fn($this->read()));return $this->summary();}
  finally{flock($lock,LOCK_UN);fclose($lock);}
 }
 public function publicConfig():array {
  if($this->demo())return ['enabled'=>true,'demo'=>true,'coverage'=>'Alberta','automatic'=>false];
  $s=$this->read();return ['enabled'=>$s['enabled']&&$s['endpoint']!==''&&$s['password']!=='','demo'=>false,'coverage'=>'Alberta','automatic'=>true];
 }
 public function summary():array {
  if($this->demo())return ['enabled'=>true,'configured'=>true,'demo'=>true,'coverage'=>'Alberta','revision'=>'demo'];
  $s=$this->read();return ['enabled'=>$s['enabled'],'configured'=>$s['endpoint']!==''&&$s['password']!=='','demo'=>false,'coverage'=>'Alberta','revision'=>Catalog::revision($s)];
 }
 public function save(array $body):array {
  if($this->demo())throw new ApiError('This setting is locked by the installation owner.',403);
  if(!is_bool($body['enabled']??null)||!is_string($body['revision']??null))throw new ApiError('Choose whether address lookup is enabled.');
  return $this->change(function($s)use($body){
   if(!hash_equals(Catalog::revision($s),$body['revision']))throw new ApiError('Address lookup settings changed. Reload before saving.',409);
   if($body['enabled']&&($s['endpoint']===''||$s['password']===''))throw new ApiError('Ask the installation owner to configure the address service first.');
   $s['enabled']=$body['enabled'];return $s;
  });
 }
 /** Server owner provisioning only. No HTTP route accepts endpoints or credentials. */
 public function provision(array $client):array {
  if(PHP_SAPI!=='cli')throw new ApiError('Server configuration is required.',403);
  $url=$client['endpoint']??'';$parts=is_string($url)?parse_url($url):false;
  if(!$parts||($parts['scheme']??'')!=='https'||empty($parts['host'])||($parts['path']??'')!=='/search'||isset($parts['user'])||isset($parts['pass'])||isset($parts['query'])||isset($parts['fragment'])||isset($parts['port'])||!preg_match('/^[a-z0-9.-]+$/iD',$parts['host'])||preg_match('/(^|\.)openstreetmap\.org$/iD',$parts['host']))throw new ApiError('Use the HTTPS search endpoint of your own Nominatim server.');
  foreach(['username','password'] as $field)if(!is_string($client[$field]??null)||!preg_match('/^[A-Za-z0-9_-]{1,200}$/D',$client[$field]))throw new ApiError('Invalid address service credentials.');
  return $this->change(fn($s)=>['enabled'=>true,'endpoint'=>$url,'username'=>$client['username'],'password'=>$client['password']]);
 }
 public function search(array $body):array {
  $q=$body['query']??null;
  if(!is_string($q)||!preg_match('//u',$q)||preg_match('/[\x00-\x1f\x7f]/u',$q)||mb_strlen(trim($q))<4||mb_strlen($q)>240)throw new ApiError('Enter an address and city, between 4 and 240 characters.');
  if($this->demo())return ['results'=>[['label'=>'123 Example Avenue NW, Edmonton, AB, T5A 1A1, Canada','line1'=>'123 Example Avenue NW','city'=>'Edmonton','region'=>'AB','postalCode'=>'T5A 1A1','country'=>'Canada']],'demo'=>true];
  $s=$this->read();if(!$s['enabled']||$s['endpoint']===''||$s['password']==='')throw new ApiError('Address lookup is unavailable. Enter the address manually.',503);
  try{$rows=$this->transport?($this->transport)($s,trim($q)):$this->fetch($s,trim($q));}
  catch(\Throwable){throw new ApiError('Address lookup is temporarily unavailable. Enter the address manually.',503);}
  if(!is_array($rows)||!array_is_list($rows))throw new ApiError('Address lookup is temporarily unavailable. Enter the address manually.',503);
  $results=[];
  foreach(array_slice($rows,0,5) as $row){
   $a=$row['address']??[];if(!is_array($a)||($a['country_code']??'')!=='ca')continue;
   $text=static fn($value,$max=120)=>is_string($value)?mb_substr(preg_replace('/[\x00-\x1f\x7f]/u','',$value)??'',0,$max):'';
   $road=$a['road']??$a['pedestrian']??$a['residential']??$a['footway']??'';
   $region=$a['ISO3166-2-lvl4']??$a['state']??'';if(is_string($region)&&str_starts_with($region,'CA-'))$region=substr($region,3);
   $postal=strtoupper(trim($text($a['postcode']??'',20)));if(empty($a['house_number'])||!preg_match('/^[A-Z]\d[A-Z] ?\d[A-Z]\d$/D',$postal))$postal='';
   $results[]=['label'=>$text($row['display_name']??'',500),'line1'=>$text(trim($text($a['house_number']??'').' '.$text($road))),'city'=>$text($a['city']??$a['town']??$a['village']??$a['hamlet']??'',80),'region'=>$text($region,60),'postalCode'=>$postal,'country'=>$text($a['country']??'Canada',60)];
  }
  return ['results'=>$results,'demo'=>false];
 }
 private function fetch(array $s,string $q):array {
  if(!function_exists('curl_init'))throw new \RuntimeException();
  $url=$s['endpoint'].'?'.http_build_query(['q'=>$q,'format'=>'jsonv2','addressdetails'=>1,'countrycodes'=>'ca','limit'=>5,'accept-language'=>'en']);
  $ch=curl_init($url);$body='';
  curl_setopt_array($ch,[CURLOPT_HTTPAUTH=>CURLAUTH_BASIC,CURLOPT_USERPWD=>$s['username'].':'.$s['password'],CURLOPT_FOLLOWLOCATION=>false,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_CONNECTTIMEOUT=>2,CURLOPT_TIMEOUT=>10,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_USERAGENT=>'DYWS-address-lookup/1.0',CURLOPT_HTTPHEADER=>['Accept: application/json'],CURLOPT_WRITEFUNCTION=>static function($ch,$part)use(&$body){if(strlen($body)+strlen($part)>262144)return 0;$body.=$part;return strlen($part);}]);
  try{if(curl_exec($ch)===false||curl_getinfo($ch,CURLINFO_HTTP_CODE)!==200)throw new \RuntimeException();return json_decode($body,true,32,JSON_THROW_ON_ERROR);}
  finally{unset($ch);}
 }
}
