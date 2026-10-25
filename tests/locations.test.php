<?php
declare(strict_types=1);
require __DIR__.'/../server/bootstrap.php';
use dyws\{Catalog,Store,ApiError};
$dir=sys_get_temp_dir().'/dyws-locations-'.bin2hex(random_bytes(6));mkdir($dir,0700);
$GLOBALS['dyws_config']=['tracking_secret'=>str_repeat('x',64)];$checks=0;
function check(bool $ok):void {global $checks;if(!$ok)throw new RuntimeException('Check '.($checks+1).' failed');$checks++;}
function rejects(callable $fn,int $code=422):void {try{$fn();throw new RuntimeException('Expected rejection');}catch(ApiError $e){check($e->http===$code);}}
try{
 $catalog=Catalog::load(__DIR__.'/../examples/starlit-diner/catalog.json');
 $catalog['locations']=[['id'=>'north','name'=>'North','address'=>'100 Example Road','phone'=>'7805550142','active'=>true],['id'=>'west','name'=>'West','address'=>'200 Example Road','phone'=>'7805550143','active'=>true],['id'=>'closed','name'=>'Closed','address'=>'300 Example Road','phone'=>'','active'=>false]];
 $catalog=Catalog::validate($catalog);check(count($catalog['locations'])===3);
 $bad=$catalog;$bad['locations'][1]['id']='north';rejects(fn()=>Catalog::validate($bad));
 $bad=$catalog;$bad['locations'][0]['address']='';rejects(fn()=>Catalog::validate($bad));
 $bad=$catalog;$bad['locations'][0]['active']='yes';rejects(fn()=>Catalog::validate($bad));
 $store=new Store($dir.'/orders.sqlite',$catalog,'locations');
 $body=['idempotencyKey'=>'locations-example-key','customer'=>['name'=>'Fictional Guest','phone'=>'7805550100'],'fulfillment'=>'pickup','lines'=>[['id'=>$catalog['categories'][0]['items'][0]['id'],'variant'=>'','quantity'=>1]]];
 rejects(fn()=>$store->create($body));
 foreach(['closed','unknown'] as $id)rejects(fn()=>$store->create($body+['locationId'=>$id]));
 $body['locationId']='west';$body['orderLocation']=['name'=>'Forged','address'=>'Forged'];
 $receipt=$store->create($body);$order=$store->safeOrder($store->get($receipt['id']));check($order['orderLocation']['name']==='West');check($order['orderLocation']['address']==='200 Example Road');
 check($store->create($body)['id']===$receipt['id']);
 $other=$body;$other['locationId']='north';rejects(fn()=>$store->create($other),409);
 $edited=$catalog;$edited['locations']=[$catalog['locations'][0]];$updated=new Store($dir.'/orders.sqlite',$edited,'locations');
 check($updated->create($body)['id']===$receipt['id']);
 $tracking=$updated->tracking($receipt['id'],$receipt['trackingToken']);check($tracking['orderLocation']['name']==='West');check($tracking['business']['pickupAddress']==='200 Example Road');check($tracking['business']['phone']==='7805550143');
 $otherTenant=new Store($dir.'/orders.sqlite',$catalog,'other');rejects(fn()=>$otherTenant->get($receipt['id']),404);
 $delivery=$body;$delivery['idempotencyKey']='locations-delivery-key';$delivery['fulfillment']='delivery';$delivery['address']='123 Fictional Street';$r=$store->create($delivery);check($store->safeOrder($store->get($r['id']))['orderLocation']['id']==='west');
 $single=$catalog;$single['locations']=[$catalog['locations'][0]];$singleStore=new Store($dir.'/single.sqlite',$single,'single');unset($body['locationId']);$r=$singleStore->create($body);check($singleStore->safeOrder($singleStore->get($r['id']))['orderLocation']['id']==='north');
 $legacy=$catalog;unset($legacy['locations']);$legacy=Catalog::validate($legacy);$legacyStore=new Store($dir.'/legacy.sqlite',$legacy,'legacy');$r=$legacyStore->create($body);check($legacyStore->safeOrder($legacyStore->get($r['id']))['orderLocation']['address']===$legacy['pickupAddress']);
 // Existing databases acquire the new snapshot column without changing saved orders.
 $legacyStore->db->exec('ALTER TABLE orders DROP COLUMN order_location_json');$migrated=new Store($dir.'/legacy.sqlite',$legacy,'legacy');check($migrated->get($r['id'])['order_location_json']==='{}');
 echo "Business location checks: $checks passed\n";
}finally{foreach(glob($dir.'/*') as $f)unlink($f);rmdir($dir);}
