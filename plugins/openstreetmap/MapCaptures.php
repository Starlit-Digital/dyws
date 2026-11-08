<?php
declare(strict_types=1);
namespace dyws\Plugins\OpenStreetMap;
use dyws\{Store,ApiError};
/** Short lived, tenant private raster staging. Captures are never publicly served. */
final class MapCaptures {
 private string $dir;
 public function __construct(Store $store,array $config){$this->dir=dirname($config['database']).'/map-pdf-captures/'.hash('sha256',$store->tenant);}
 private function clean():void{foreach(glob($this->dir.'/*.json')?:[] as $file)if(is_file($file)&&filemtime($file)<time()-900)unlink($file);}
 public function save(array $context):string {
  if(!is_dir($this->dir)&&!mkdir($this->dir,0700,true)&&!is_dir($this->dir))throw new ApiError('Map capture storage is unavailable.',503);$this->clean();if(count(glob($this->dir.'/*.json')?:[])>=64)throw new ApiError('Too many pending map captures. Try again shortly.',429);
  $context['data']=array_intersect_key($context['data'],array_flip(['demo','locations','omittedOrders']));$context['data']['locations']=array_values(array_filter($context['data']['locations'],fn($location)=>$location['id']===$context['scope']['location']));$context['catalog']=['businessName'=>$context['catalog']['businessName']];$id=bin2hex(random_bytes(16));$path=$this->dir.'/'.$id.'.json';$bytes=json_encode($context,JSON_THROW_ON_ERROR);if(strlen($bytes)>350000)throw new ApiError('Map capture metadata is too large.',413);if(file_put_contents($path,$bytes,LOCK_EX)!==strlen($bytes)||!chmod($path,0600)){if(is_file($path))unlink($path);throw new ApiError('The map capture could not be saved.',503);}return $id;
 }
 public function load(string $id):array {if(!preg_match('/^[a-f0-9]{32}$/D',$id))throw new ApiError('Map capture not found.',404);$path=$this->dir.'/'.$id.'.json';if(!is_file($path))throw new ApiError('Map capture not found.',404);if(filemtime($path)<time()-900){unlink($path);throw new ApiError('Map capture expired. Prepare the export again.',410);}if(filesize($path)>350000)throw new ApiError('Map capture is invalid.',503);return json_decode(file_get_contents($path),true,64,JSON_THROW_ON_ERROR);}
 public function remove(string $id):void{if(preg_match('/^[a-f0-9]{32}$/D',$id)&&is_file($this->dir.'/'.$id.'.json'))unlink($this->dir.'/'.$id.'.json');}
}
