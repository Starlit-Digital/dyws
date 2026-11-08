<?php
declare(strict_types=1);
namespace dyws\Plugins\OpenStreetMap;
use dyws\{ApiError,Catalog,Store};
final class Settings {
 public const OSM_TILES='https://tile.openstreetmap.org/{z}/{x}/{y}.png';
 private string $path;
 public function __construct(private array $config){$this->path=dirname($config['database']).'/openstreetmap-'.substr(hash('sha256',$config['tenant']),0,16).'.json';}
 public function read():array {return is_file($this->path)?self::validate(json_decode(file_get_contents($this->path),true,32,JSON_THROW_ON_ERROR)):['enabled'=>true,'tileUrl'=>self::OSM_TILES,'attribution'=>'','maxZoom'=>19,'businessPoints'=>[]];}
 public function summary():array {$data=$this->read();$catalog=Catalog::load($this->config['catalog']);$locations=$catalog['locations']?:[['id'=>'','name'=>$catalog['businessName'],'address'=>$catalog['pickupAddress']]];$known=array_fill_keys(array_column($locations,'id'),true);foreach($data['businessPoints'] as $point)if(!isset($known[$point['locationId']])){$locations[]=['id'=>$point['locationId'],'name'=>$point['locationId']===''?'Saved default location':'Saved location '.$point['locationId'],'address'=>'Saved coordinates retained for historical orders'];$known[$point['locationId']]=true;}return $data+['revision'=>Catalog::revision($data),'locations'=>array_map(fn($v)=>array_intersect_key($v,array_flip(['id','name','address'])),$locations),'communityTiles'=>$data['tileUrl']===self::OSM_TILES];}
 public static function validate($data):array {
  if(!is_array($data)||!is_bool($data['enabled']??null))throw new ApiError('Choose whether the order map is enabled.');
  $url=$data['tileUrl']??self::OSM_TILES;if(!is_string($url)||strlen($url)>600||str_contains($url,'\\')||preg_match('/[\x00-\x20]/',$url)||array_filter(['{z}','{x}','{y}'],fn($part)=>substr_count($url,$part)!==1))throw new ApiError('Use a tile URL with one each of {z}, {x} and {y}.');
  $parts=parse_url($url);$relative=str_starts_with($url,'/')&&!str_starts_with($url,'//');
  if(!$parts||isset($parts['user'])||isset($parts['pass'])||isset($parts['fragment'])||(!$relative&&(($parts['scheme']??'')!=='https'||empty($parts['host']))))throw new ApiError('Use an HTTPS tile URL or a same origin path.');
  if(isset($parts['host'])&&preg_match('/(^|\.)openstreetmap\.org$/iD',$parts['host'])&&$url!==self::OSM_TILES)throw new ApiError('Use the standard OpenStreetMap tile URL.');
  $attribution=$data['attribution']??'';if(!is_string($attribution)||mb_strlen($attribution)>200||preg_match('/[\x00-\x1f<>]/u',$attribution))throw new ApiError('Use plain text for additional tile attribution.');
  $zoom=$data['maxZoom']??19;if(!is_int($zoom)||$zoom<1||$zoom>19)throw new ApiError('Maximum zoom must be between 1 and 19.');
  $points=$data['businessPoints']??[];if(!is_array($points)||!array_is_list($points)||count($points)>50)throw new ApiError('Use up to 50 business locations.');$out=[];$seen=[];
  foreach($points as $p){if(!is_array($p))throw new ApiError('Use valid business coordinate rows.');$id=$p['locationId']??null;if(!is_string($id)||!preg_match('/^[a-zA-Z0-9_-]{0,80}$/D',$id)||isset($seen[$id]))throw new ApiError('Choose a unique business location.');$seen[$id]=true;foreach(['latitude'=>90,'longitude'=>180] as $key=>$bound)if(!is_int($p[$key]??null)&&!is_float($p[$key]??null)||!is_finite((float)($p[$key]??INF))||abs((float)($p[$key]??INF))>$bound)throw new ApiError('Enter valid business coordinates.');$out[]=['locationId'=>$id,'latitude'=>(float)$p['latitude'],'longitude'=>(float)$p['longitude']];}
  return ['enabled'=>$data['enabled'],'tileUrl'=>$url,'attribution'=>$attribution,'maxZoom'=>$zoom,'businessPoints'=>$out];
 }
 public function save(array $body):array {$revision=Store::text($body['revision']??null,64);$next=self::validate($body);$lock=fopen($this->path.'.lock','c');try{if(!$lock||!flock($lock,LOCK_EX))throw new ApiError('Map settings are busy.',503);if(!hash_equals(Catalog::revision($this->read()),$revision))throw new ApiError('Map settings changed. Reload before saving.',409);Catalog::write($this->path,$next);return $this->summary();}finally{if($lock){flock($lock,LOCK_UN);fclose($lock);}}}
}
