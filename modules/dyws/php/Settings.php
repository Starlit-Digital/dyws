<?php
declare(strict_types=1);
namespace StarlitGo;
use DateTimeZone;

/** Display preferences only. Internal authorization roles never change. */
final class Settings {
 private string $path;
 public function __construct(array $config) {
  $this->path=dirname($config['database']).'/settings-'.substr(hash('sha256',$config['tenant']),0,16).'.json';
 }
 public function read():array {
  if(!is_file($this->path))return ['driverRole'=>['singular'=>'Driver','plural'=>'Drivers'],'timeZone'=>'America/Edmonton'];
  return self::validate(json_decode(file_get_contents($this->path),true,32,JSON_THROW_ON_ERROR));
 }
 private static function validate(array $data):array {
  $role=$data['driverRole']??null;
  if(!is_array($role))throw new ApiError('Provide a role name and plural name.');
  $out=[];
  foreach(['singular','plural'] as $key){
   $value=$role[$key]??null;
   if(!is_string($value)||preg_match('/[\p{C}]/u',$value)||!preg_match('/\S/u',$value)||preg_match_all('/./us',$value)>60)throw new ApiError('Use a role name of 1 to 60 characters without control characters.');
   $out[$key]=trim($value);
  }
  $zone=array_key_exists('timeZone',$data)?$data['timeZone']:'America/Edmonton';
  if(!is_string($zone)||!in_array($zone,DateTimeZone::listIdentifiers(),true))throw new ApiError('Choose a valid timezone.');
  return ['driverRole'=>$out,'timeZone'=>$zone];
 }
 public function summary():array {
  $settings=$this->read();return ['settings'=>$settings,'revision'=>Catalog::revision($settings),'timeZones'=>DateTimeZone::listIdentifiers()];
 }
 public function save(array $body):array {
  if(!is_array($body['settings']??null))throw new ApiError('Provide settings.');
  self::validate($body['settings']);
  $revision=Store::text($body['revision']??null,64);
  $lock=fopen($this->path.'.lock','c');if(!$lock)throw new ApiError('Settings are busy.',503);
  try{
   if(!flock($lock,LOCK_EX))throw new ApiError('Settings are busy.',503);
   $current=$this->read();
   if(!hash_equals(Catalog::revision($current),$revision))throw new ApiError('Settings changed. Reload before saving.',409);
   $settings=self::validate(array_replace($current,$body['settings']));
   Catalog::write($this->path,$settings);
   return ['settings'=>$settings,'revision'=>Catalog::revision($settings),'timeZones'=>DateTimeZone::listIdentifiers()];
  }finally{flock($lock,LOCK_UN);fclose($lock);}
 }
}
