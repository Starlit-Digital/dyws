<?php
declare(strict_types=1);
namespace dyws;

/** Product data is JSON. Prices are integer minor units, never floating point. */
final class Catalog {
 public static function load(string $path):array { return self::validate(json_decode(file_get_contents($path),true,64,JSON_THROW_ON_ERROR)); }
 public static function validate(array $data):array {
  $out=['schemaVersion'=>2,'businessName'=>Store::text($data['businessName']??$data['restaurant']??null,120),'platformName'=>Store::text($data['platformName']??'dyws',100),'currency'=>$data['currency']??'CAD','taxBasisPoints'=>$data['taxBasisPoints']??0,'deliveryFee'=>$data['deliveryFee']??395,'pickupAddress'=>Store::text($data['pickupAddress']??'',240,false),'categories'=>[]];
  if(!in_array($out['currency'],['CAD','USD'],true))throw new ApiError('Use CAD or USD. Other currency decimal rules are not supported yet.');
  self::integer($out['taxBasisPoints'],0,10000);self::integer($out['deliveryFee'],0,100000);
  if(!isset($data['categories'])||!is_array($data['categories'])||!array_is_list($data['categories'])||count($data['categories'])>50)throw new ApiError('Use up to 50 categories.');
  $ids=[];$cats=[];$count=0;
  foreach($data['categories'] as $category){
   if(!is_array($category))throw new ApiError('Invalid category.');
   $c=['id'=>self::id($category['id']??null),'name'=>Store::text($category['name']??null,120),'items'=>[]];
   if(isset($cats[$c['id']]))throw new ApiError('Category IDs must be unique.');$cats[$c['id']]=true;
   if(isset($category['image']))$c['image']=self::image($category['image']);
   if(!is_array($category['items']??null)||!array_is_list($category['items']))throw new ApiError('Category items must be a list.');
   foreach($category['items'] as $item){
    if(!is_array($item)||++$count>1000)throw new ApiError('Use up to 1000 products.');
    $i=['id'=>self::id($item['id']??null),'sku'=>Store::text($item['sku']??'',80,false),'name'=>Store::text($item['name']??null,120),'description'=>Store::text($item['description']??'',2000,false),'price'=>$item['price']??null,'active'=>$item['active']??true,'unit'=>Store::text($item['unit']??'each',40),'metadata'=>$item['metadata']??[]];
    if(isset($ids[$i['id']]))throw new ApiError('Product IDs must be unique.');$ids[$i['id']]=true;self::integer($i['price'],0,100000);
    if(!is_bool($i['active'])||!is_array($i['metadata'])||count($i['metadata'])>20)throw new ApiError('Invalid availability or metadata.');
    foreach($i['metadata'] as $k=>$v)if(!is_string($k)||strlen($k)>60||!is_scalar($v)||strlen((string)$v)>250)throw new ApiError('Metadata must contain short named values.');
    if(isset($item['image']))$i['image']=self::image($item['image']);
    if(!empty($item['variants'])){
     if(!is_array($item['variants'])||!array_is_list($item['variants'])||count($item['variants'])>50)throw new ApiError('Invalid product options.');
     $i['optionLabel']=Store::text($item['optionLabel']??'Option',60);$i['variants']=[];$variants=[];
     foreach($item['variants'] as $v){if(!is_array($v))throw new ApiError('Invalid option.');$v=['id'=>self::id($v['id']??null),'name'=>Store::text($v['name']??null,100),'price'=>$v['price']??null];self::integer($v['price'],0,100000);if(isset($variants[$v['id']]))throw new ApiError('Option IDs must be unique.');$variants[$v['id']]=true;$i['variants'][]=$v;}
    }
    $c['items'][]=$i;
   }
   $out['categories'][]=$c;
  }
  return $out;
 }
 private static function integer($v,int $min,int $max):void {if(!is_int($v)||$v<$min||$v>$max)throw new ApiError('Prices, fees and tax rates must be whole numbers within the supported range.');}
 private static function id($v):string {if(!is_string($v)||!preg_match('/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/',$v))throw new ApiError('Use letters, numbers and underscores for IDs.');return $v;}
 private static function image($v):array {
  if(!is_array($v))throw new ApiError('Image needs src and alt fields.');$src=Store::text($v['src']??null,1000);$alt=Store::text($v['alt']??'',250,false);
  if(!preg_match('~^(https://[^\s]+|[a-zA-Z0-9][a-zA-Z0-9_./-]*)$~',$src)||str_contains($src,'..'))throw new ApiError('Use an HTTPS image URL or a relative image path.');
  return ['src'=>$src,'alt'=>$alt];
 }
 public static function publicData(array $catalog):array {
  foreach($catalog['categories'] as &$c)$c['items']=array_values(array_filter($c['items'],fn($i)=>$i['active']));unset($c);
  return $catalog;
 }
 public static function revision(array $catalog):string {return hash('sha256',json_encode($catalog,JSON_THROW_ON_ERROR));}
 public static function save(string $path,array $data,string $revision):array {
  $validated=self::validate($data);$lock=fopen($path.'.lock','c');if(!$lock||!flock($lock,LOCK_EX))throw new ApiError('Catalog is busy.',503);
  try {if(!hash_equals(self::revision(self::load($path)),$revision))throw new ApiError('The catalog changed. Reload it before saving.',409);
   // One tenant uses one reporting currency. A new currency needs a separate deployment.
   if(self::load($path)['currency']!==$validated['currency'])throw new ApiError('The currency cannot change for an existing business.',409);
   self::write($path,$validated);return $validated;
  }finally{flock($lock,LOCK_UN);fclose($lock);}
 }
 public static function write(string $path,array $data):void {
  $temp=tempnam(dirname($path),'.json-');try{chmod($temp,0600);if(file_put_contents($temp,json_encode($data,JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR)."\n")===false||!rename($temp,$path))throw new ApiError('Could not save configuration.',503);}finally{if(is_file($temp))unlink($temp);}
 }
}
