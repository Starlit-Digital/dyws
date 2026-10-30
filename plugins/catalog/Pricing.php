<?php
declare(strict_types=1);
namespace dyws\Plugins\Catalog;
use dyws\{Store,Catalog,ApiError};
final class Pricing {
 public static function cart(array $catalog,mixed $input):array {
  if(!is_array($input)||count($input)<1||count($input)>50)throw new ApiError('Choose between 1 and 50 items.');
  $menu=[];foreach($catalog['categories'] as $c)foreach($c['items'] as $i)$menu[$i['id']]=$i;
  $lines=[];$subtotal=0;$seen=[];$itemCounts=[];$itemOrderCap=$catalog['itemOrderCap']??10;
  foreach($input as $row){$id=$row['id']??'';$variant=$row['variant']??'';$qty=$row['quantity']??null;if(!is_string($id)||!is_string($variant)||!is_int($qty)||$qty<1||$qty>99||!isset($menu[$id]))throw new ApiError('Invalid product selection.');
   $itemCounts[$id]=($itemCounts[$id]??0)+$qty;if($itemCounts[$id]>$itemOrderCap)throw new ApiError('Online orders are limited to '.$itemOrderCap.' of each item. Please call the store for a larger order.');
   $item=$menu[$id];if(($item['active']??true)!==true)throw new ApiError('This product is unavailable.');$price=$item['price'];$option='';if(!empty($item['variants'])){$found=false;foreach($item['variants'] as $v)if($v['id']===$variant){$price=$v['price'];$option=$v['name'];$found=true;}if(!$found)throw new ApiError('Choose a valid item option.');}elseif($variant!=='')throw new ApiError('Invalid item option.');
   $choices=Catalog::selections($item,$row['selections']??[]);$price+=$choices['price'];$option=implode(' · ',array_filter(array_merge([$option],$choices['labels'])));
   $lineKey=$id.':'.$variant.':'.json_encode($choices['selections']);if(isset($seen[$lineKey]))throw new ApiError('Combine duplicate item quantities.');$seen[$lineKey]=true;
   $lines[]=['id'=>$id,'variant'=>$variant,'name'=>$item['name'],'sku'=>$item['sku']??'','unit'=>$item['unit']??'each','description'=>$item['description']??'','image'=>$item['image']??null,'option'=>$option,'price'=>$price,'quantity'=>$qty];if(!empty($item['optionGroups']))$lines[array_key_last($lines)]['selections']=$choices['selections'];$subtotal+=$price*$qty;
  }
  if($subtotal>100000)throw new ApiError('Orders are limited to $1,000.');
  return ['lines'=>$lines,'subtotal'=>$subtotal];
 }
}
