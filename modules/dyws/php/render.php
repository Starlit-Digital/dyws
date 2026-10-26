<?php
declare(strict_types=1);

/** Read product JSON without starting sessions, opening a database or exposing config. */
function dyws_load_catalog(string $path):array {return \dyws\Catalog::publicData(\dyws\Catalog::load($path));}
function dyws_catalog_from_config(string $configPath):array {
 $config=json_decode(file_get_contents($configPath),true,64,JSON_THROW_ON_ERROR);
 return \dyws\Catalog::publicData(\dyws\Catalog::load($config['catalog']),(new \dyws\Settings($config))->read()['timeZone'],(new \dyws\Settings($config))->read()['acceptingOrders']);
}
function dyws_escape(string $value):string {return htmlspecialchars($value,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}

/** Published location and ordering hours use the same policy as checkout. */
function dyws_render_business_hours(array $catalog):string {
 $html=($catalog['acceptingOrders']??true)?'':'<p role="status">Online ordering is temporarily paused. Existing orders are still being handled.</p>';
 $locations=$catalog['locations']??[];if(!$locations)$locations=[['id'=>'','name'=>$catalog['businessName']??'Business','active'=>true]];
 $days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
 foreach($locations as $location){
  if(!$location['active'])continue;$policy=\dyws\Catalog::locationPolicy($catalog,$location['id']);
  foreach(['locationHours'=>'Location hours','orderingHours'=>'Ordering hours'] as $key=>$label){
   $schedule=$policy[$key]??null;if(!$schedule||!$schedule['enabled'])continue;
   $html.='<details class="dyws-published-hours"><summary>'.dyws_escape($location['name'].' · '.$label).'</summary><p>'.dyws_escape($catalog['timeZone']??'America/Edmonton').'</p><dl>';
   foreach($schedule['days'] as $i=>$day){$time=$day['mode']==='closed'?'Closed':($day['mode']==='allDay'?'24 hours':$day['open'].' to '.$day['close'].($day['close']<$day['open']?' next day':''));$html.='<div><dt>'.$days[$i].'</dt><dd>'.dyws_escape($time).'</dd></div>';}
   $html.='</dl></details>';
  }
 }
 return $html;
}

/** Functions return HTML so the host chooses where to echo each component. */
function dyws_render_menu(array $catalog,array $options=[]):string {return (new DYWSRenderer($catalog))->menu($options);}
function dyws_render_category(array $catalog,string $categoryId,array $options=[]):string {return (new DYWSRenderer($catalog))->category($categoryId,$options);}
function dyws_render_item(array $catalog,string $itemId,array $options=[]):string {return (new DYWSRenderer($catalog))->item($itemId,$options);}
function dyws_render_navigation(array $catalog):string {return (new DYWSRenderer($catalog))->navigation();}

final class DYWSRenderer {
 private array $catalog;
 public function __construct(array $catalog){$this->catalog=\dyws\Catalog::publicData(\dyws\Catalog::validate($catalog));}
 private function wrap(string $html,array $options):string {
  $id=isset($options['id'])?' id="'.dyws_escape((string)$options['id']).'"':'';
  return '<div'.$id.' class="dyws-catalog" data-dyws-rendered tabindex="-1">'.$html.'</div>';
 }
 private function price(int $cents):string {return ($this->catalog['currency']==='USD'?'US$':'$').number_format($cents/100,2,'.',',');}
 private function image(array $image,string $class):string {return '<img class="'.$class.'" src="'.dyws_escape($image['src']).'" alt="'.dyws_escape($image['alt']).'" loading="lazy" decoding="async">';}
 public function menu(array $options=[]):string {return $this->wrap(implode('',array_map(fn($c)=>$this->categoryPanel($c),$this->catalog['categories'])),$options);}
 public function category(string $id,array $options=[]):string {
  foreach($this->catalog['categories'] as $category)if($category['id']===$id)return $this->wrap($this->categoryPanel($category),$options);
  throw new InvalidArgumentException('Unknown DYWS category.');
 }
 public function item(string $id,array $options=[]):string {
  foreach($this->catalog['categories'] as $category)foreach($category['items'] as $item)if($item['id']===$id)return $this->wrap($this->itemPanel($item,true),$options);
  throw new InvalidArgumentException('Unknown or unavailable DYWS item.');
 }
 public function navigation():string {
  return implode('',array_map(fn($c)=>'<a href="#'.dyws_escape($c['id']).'">'.dyws_escape($c['name']).'</a>',$this->catalog['categories']));
 }
 private function categoryPanel(array $category):string {
  $html='<section id="'.dyws_escape($category['id']).'" class="dyws-category"><h2>'.dyws_escape($category['name']).'</h2><div class="dyws-category-layout">';
  if(isset($category['image']))$html.=$this->image($category['image'],'dyws-category-photo');
  $html.='<div class="dyws-products">';
  foreach($category['items'] as $item)$html.=$this->itemPanel($item,!isset($category['image']));
  return $html.'</div></div></section>';
 }
 private function itemPanel(array $item,bool $showImage):string {
  $name=dyws_escape($item['name']);
  $html='<article class="dyws-product"><div>';
  if($showImage&&isset($item['image']))$html.=$this->image($item['image'],'dyws-product-image');
  $html.='<h3>'.$name.'</h3><p>'.dyws_escape($item['description']).'</p>';
  if(!empty($item['variants'])){
   $html.='<label>'.dyws_escape($item['optionLabel']??'Option').' <select aria-label="'.$name.' option">';
   foreach($item['variants'] as $variant)$html.='<option value="'.dyws_escape($variant['id']).'">'.dyws_escape($variant['name']).'</option>';
   $html.='</select></label>';
  }
  $price=$item['variants'][0]['price']??$item['price'];
  $html.='</div><div class="dyws-product-action"><span>'.$this->price($price).'</span><div class="dyws-item-controls" data-order-item="'.dyws_escape($item['id']).'">';
  $html.='<button type="button" class="dyws-item-add" data-dyws-action="add" aria-label="Add '.$name.'" disabled>Add</button><div class="dyws-item-stepper" role="group" aria-label="'.$name.' quantity" hidden>';
  $html.='<button type="button" class="dyws-item-minus" data-dyws-action="remove" aria-label="Remove one '.$name.'">−</button><output aria-label="'.$name.' quantity" aria-live="polite">0</output><button type="button" class="dyws-item-plus" data-dyws-action="add" aria-label="Add one '.$name.'">+</button>';
  return $html.'</div></div></div></article>';
 }
}
