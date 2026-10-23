<?php
declare(strict_types=1);
namespace dyws\Plugins\GoogleMaps;
use dyws\{Catalog,Store,ApiError};

/** Browser API keys are public by design. Restrict them to the site's origin in Google Cloud. */
final class MapsSettings {
 private string $path;
 public function __construct(array $config){$this->path=dirname($config['database']).'/maps-'.substr(hash('sha256',$config['tenant']),0,16).'.json';}
 private function read():array{return is_file($this->path)?json_decode(file_get_contents($this->path),true,32,JSON_THROW_ON_ERROR):['enabled'=>false,'browserKey'=>'','mapId'=>'DEMO_MAP_ID'];}
 public function summary():array{$data=$this->read();return ['enabled'=>$data['enabled'],'hasKey'=>$data['browserKey']!=='','mapId'=>$data['mapId'],'revision'=>Catalog::revision($data)];}
 public function publicConfig():array{$data=$this->read();return ['enabled'=>$data['enabled'],'browserKey'=>$data['enabled']?$data['browserKey']:'','mapId'=>$data['mapId']];}
 public function save(array $body):array{
  if(!is_bool($body['enabled']??null))throw new ApiError('Choose whether Google Maps is enabled.');
  $key=$body['browserKey']??'';$map=$body['mapId']??'DEMO_MAP_ID';
  if(!is_string($key)||($key!==''&&!preg_match('/^[A-Za-z0-9_-]{20,200}$/',$key)))throw new ApiError('Enter a valid Google Maps browser key.');
  if(!is_string($map)||!preg_match('/^[A-Za-z0-9_-]{1,100}$/',$map))throw new ApiError('Enter a valid map ID.');
  $revision=Store::text($body['revision']??null,64);$lock=fopen($this->path.'.lock','c');if(!$lock)throw new ApiError('Maps settings are busy.',503);
  try{if(!flock($lock,LOCK_EX))throw new ApiError('Maps settings are busy.',503);$data=$this->read();if(!hash_equals(Catalog::revision($data),$revision))throw new ApiError('Maps settings changed. Reload before saving.',409);
   if($key!=='')$data['browserKey']=$key;$data['enabled']=$body['enabled'];$data['mapId']=$map;
   if($data['enabled']&&$data['browserKey']==='')throw new ApiError('Add a browser key before enabling Google Maps.');
   Catalog::write($this->path,$data);return $this->summary();
  }finally{flock($lock,LOCK_UN);fclose($lock);}
 }
}
