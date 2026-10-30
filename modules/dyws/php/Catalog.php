<?php
declare(strict_types=1);
namespace dyws;
require_once __DIR__.'/BusinessHours.php';
require_once __DIR__.'/Cancellation.php';
require_once __DIR__.'/Deals.php';

/** Product data is JSON. Prices are integer minor units, never floating point. */
final class Catalog {
 public static function load(string $path):array { return self::validate(json_decode(file_get_contents($path),true,64,JSON_THROW_ON_ERROR)); }
 public static function validate(array $data):array {
  $out=['schemaVersion'=>2,'businessName'=>Store::text($data['businessName']??$data['restaurant']??null,120),'platformName'=>Store::text($data['platformName']??'dyws',100),'currency'=>$data['currency']??'CAD','taxBasisPoints'=>$data['taxBasisPoints']??0,'deliveryFee'=>$data['deliveryFee']??395,'deliveryFeeBasisPoints'=>$data['deliveryFeeBasisPoints']??0,'locationHours'=>BusinessHours::validate($data['locationHours']??null),'orderingHours'=>BusinessHours::validate($data['orderingHours']??null),'pickupAddress'=>Store::text($data['pickupAddress']??'',240,false),'businessPhone'=>Store::text($data['businessPhone']??'',30,false),'businessEmail'=>Store::text($data['businessEmail']??'',254,false),'itemOrderCap'=>$data['itemOrderCap']??10,'allowPayAtDoor'=>$data['allowPayAtDoor']??false,'allowPayAtPickup'=>$data['allowPayAtPickup']??false,'customerCancellation'=>Cancellation::policy($data['customerCancellation']??null),'categories'=>[]];
  if(array_key_exists('allowPayAtPickup',$data)&&!is_bool($data['allowPayAtPickup']))throw new ApiError('Choose whether to allow pay at pickup.');
  if(array_key_exists('allowPayAtDoor',$data)&&!is_bool($data['allowPayAtDoor']))throw new ApiError('Choose whether to allow pay at the door.');
  if(!is_int($out['itemOrderCap'])||$out['itemOrderCap']<1||$out['itemOrderCap']>99)throw new ApiError('Item Order Cap must be a whole number from 1 to 99.');
  if($out['businessPhone']!==''&&!preg_match('/^[0-9+() .-]{7,30}$/D',$out['businessPhone']))throw new ApiError('Enter a valid business phone number.');
  if($out['businessEmail']!==''&&!filter_var($out['businessEmail'],FILTER_VALIDATE_EMAIL))throw new ApiError('Enter a valid business email address.');
  $out['locations']=[];$locationIds=[];
  if(!is_array($data['locations']??[])||!array_is_list($data['locations']??[])||count($data['locations']??[])>50)throw new ApiError('Use up to 50 business locations.');
  foreach($data['locations']??[] as $location){
   if(!is_array($location))throw new ApiError('Invalid business location.');
   $location=['id'=>self::id($location['id']??null),'name'=>Store::text($location['name']??null,120),'address'=>Store::text($location['address']??null,240),'phone'=>Store::text($location['phone']??'',30,false),'active'=>$location['active']??true,'locationHours'=>BusinessHours::validate($location['locationHours']??null),'orderingHours'=>BusinessHours::validate($location['orderingHours']??null),'deliveryPricing'=>self::deliveryPricing($location['deliveryPricing']??null),'customerCancellation'=>Cancellation::policy($location['customerCancellation']??null)];
   if(isset($locationIds[$location['id']]))throw new ApiError('Location IDs must be unique.');
   if(!is_bool($location['active'])||($location['phone']!==''&&!preg_match('/^[0-9+() .-]{7,30}$/D',$location['phone'])))throw new ApiError('Check the location phone number and availability.');
   $locationIds[$location['id']]=true;$out['locations'][]=$location;
  }
  if(!in_array($out['currency'],['CAD','USD'],true))throw new ApiError('Use CAD or USD. Other currency decimal rules are not supported yet.');
  self::integer($out['taxBasisPoints'],0,10000);self::integer($out['deliveryFee'],0,100000);self::integer($out['deliveryFeeBasisPoints'],0,10000);
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
    if(array_key_exists('optionGroups',$item)){
     if(!is_array($item['optionGroups'])||!array_is_list($item['optionGroups'])||count($item['optionGroups'])>20)throw new ApiError('Use up to 20 option groups.');
     $i['optionGroups']=[];$groups=[];
     foreach($item['optionGroups'] as $group){
      if(!is_array($group))throw new ApiError('Invalid option group.');
      $g=['id'=>self::id($group['id']??null),'name'=>Store::text($group['name']??null,100),'min'=>$group['min']??0,'max'=>$group['max']??1,'choices'=>[]];
      self::integer($g['min'],0,50);self::integer($g['max'],1,50);
      if(isset($groups[$g['id']])||$g['min']>$g['max'])throw new ApiError('Check option group IDs and choice limits.');$groups[$g['id']]=true;
      if(!is_array($group['choices']??null)||!array_is_list($group['choices'])||count($group['choices'])<1||count($group['choices'])>50||$g['max']>count($group['choices']))throw new ApiError('Add choices and check the group limits.');
      $choices=[];foreach($group['choices'] as $choice){
       if(!is_array($choice))throw new ApiError('Invalid choice.');
       $v=['id'=>self::id($choice['id']??null),'name'=>Store::text($choice['name']??null,100),'price'=>$choice['price']??0];self::integer($v['price'],0,100000);
       if(isset($choices[$v['id']]))throw new ApiError('Choice IDs must be unique within a group.');$choices[$v['id']]=true;$g['choices'][]=$v;
      }$i['optionGroups'][]=$g;
     }
    }
    $c['items'][]=$i;
   }
   $out['categories'][]=$c;
  }
  $out['deals']=Deals::validate(array_key_exists('deals',$data)?$data['deals']:[],array_keys($ids));
  return $out;
 }
 /** Validate selections and return stable IDs, display labels and authoritative surcharge. */
 public static function selections(array $item,$input):array {
  if(!is_array($input)||($input!==[]&&array_is_list($input))||count($input)>20)throw new ApiError('Invalid item choices.');
  $known=array_column($item['optionGroups']??[],'id');foreach($input as $id=>$values)if(!in_array($id,$known,true))throw new ApiError('Unknown option group.');
  $selected=[];$labels=[];$price=0;
  foreach($item['optionGroups']??[] as $g){
   $values=$input[$g['id']]??[];
   if(!is_array($values)||!array_is_list($values)||count($values)<$g['min']||count($values)>$g['max'])throw new ApiError('Choose '.$g['min'].' to '.$g['max'].' options for '.$g['name'].'.');
   $ids=[];foreach($values as $id){if(!is_string($id)||in_array($id,$ids,true)||!in_array($id,array_column($g['choices'],'id'),true))throw new ApiError('Invalid or repeated choice.');$ids[]=$id;}
   $names=[];foreach($g['choices'] as $choice)if(in_array($choice['id'],$ids,true)){$selected[$g['id']][]=$choice['id'];$price+=$choice['price'];$names[]=$choice['name'];}
   if($names)$labels[]=$g['name'].': '.implode(', ',$names);
  }
  return ['selections'=>$selected,'labels'=>$labels,'price'=>$price];
 }
 public static function deliveryPricing($value):?array {
  if($value===null)return null;
  if(!is_array($value))throw new ApiError('Provide a flat delivery fee and percentage.');
  self::integer($value['flatFee']??null,0,100000);self::integer($value['basisPoints']??null,0,10000);
  return ['flatFee'=>$value['flatFee'],'basisPoints'=>$value['basisPoints']];
 }
 public static function locationPolicy(array $catalog,string $id):array {
  foreach($catalog['locations']??[] as $location)if($location['id']===$id)return array_replace($catalog,array_filter(array_intersect_key($location,array_flip(['locationHours','orderingHours','deliveryPricing','customerCancellation'])),fn($value)=>$value!==null));
  return $catalog;
 }
 public static function deliveryCharge(array $catalog,int $subtotal,string $fulfillment,string $locationId=''):int {
  if($fulfillment!=='delivery')return 0;
  $policy=self::locationPolicy($catalog,$locationId);$pricing=$policy['deliveryPricing']??['flatFee'=>$catalog['deliveryFee']??395,'basisPoints'=>$catalog['deliveryFeeBasisPoints']??0];
  return $pricing['flatFee']+intdiv($subtotal*$pricing['basisPoints']+5000,10000);
 }
 private static function integer($v,int $min,int $max):void {if(!is_int($v)||$v<$min||$v>$max)throw new ApiError('Prices, fees and tax rates must be whole numbers within the supported range.');}
 public static function orderLocation(array $catalog,string $id):array {
  if(!empty($catalog['locations'])){
   foreach($catalog['locations'] as $location)if($location['id']===$id&&$location['active'])return array_intersect_key($location,array_flip(['id','name','address','phone']));
   throw new ApiError('Choose an available location.');
  }
  if($id!=='')throw new ApiError('Choose an available location.');
  return ['id'=>'','name'=>$catalog['businessName']??$catalog['restaurant']??'','address'=>$catalog['pickupAddress']??'','phone'=>$catalog['businessPhone']??''];
 }
 private static function id($v):string {if(!is_string($v)||!preg_match('/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/',$v))throw new ApiError('Use letters, numbers and underscores for IDs.');return $v;}
 private static function image($v):array {
  if(!is_array($v))throw new ApiError('Image needs src and alt fields.');$src=Store::text($v['src']??null,1000);$alt=Store::text($v['alt']??'',250,false);
  if(!preg_match('~^(https://[^\s]+|[a-zA-Z0-9][a-zA-Z0-9_./-]*)$~',$src)||str_contains($src,'..'))throw new ApiError('Use an HTTPS image URL or a relative image path.');
  return ['src'=>$src,'alt'=>$alt];
 }
 public static function publicData(array $catalog,string $timeZone='America/Edmonton',bool $acceptingOrders=true):array {
  $catalog['fulfillmentModes']=[];
  $catalog['deals']=Deals::publicList($catalog,$timeZone);$catalog['timeZone']=$timeZone;$catalog['acceptingOrders']=$acceptingOrders;
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
