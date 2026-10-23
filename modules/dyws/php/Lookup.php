<?php
declare(strict_types=1);
namespace StarlitGo;
/** Manager only lookup. SQL, order ownership and credentials never come from plugins or queries. */
final class Lookup {
 public static function search(Store $store,array $catalog,array $drivers,string $query,string $kind='all'):array {
  $results=[];$needle=strtolower($query);
  if(in_array($kind,['all','products'],true))foreach($catalog['categories'] as $category)foreach($category['items'] as $item){
   if(count($results)>=20)break 2;
   if(str_contains(strtolower($item['name'].' '.$item['id'].' '.($item['sku']??'')),$needle))$results[]=['kind'=>'product','id'=>$item['id'],'label'=>$item['name'],'active'=>$item['active']];
  }
  if(in_array($kind,['all','orders'],true)){
   $like='%'.strtr($query,['\\'=>'\\\\','%'=>'\\%','_'=>'\\_']).'%';
   foreach($store->query("SELECT id,status FROM orders WHERE tenant=? AND (id LIKE ? ESCAPE '\\' OR customer_name LIKE ? ESCAPE '\\') ORDER BY created_at DESC LIMIT 20",[$store->tenant,$like,$like]) as $order)$results[]=['kind'=>'order','id'=>$order['id'],'label'=>$order['id'],'status'=>$order['status']];
  }
  if(in_array($kind,['all','drivers'],true))foreach($drivers as $id=>$driver)if(str_contains(strtolower($id.' '.$driver['name']),$needle))$results[]=['kind'=>'driver','id'=>$id,'label'=>$driver['name'],'active'=>$driver['active']??true];
  return ['results'=>array_slice($results,0,40)];
 }
}
