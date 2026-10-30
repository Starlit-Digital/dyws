<?php
declare(strict_types=1);
require __DIR__.'/../server/Store.php';
use dyws\Store;use dyws\ApiError;
$path=tempnam(sys_get_temp_dir(),'dyws-test-');$catalog=json_decode(file_get_contents(__DIR__.'/../examples/starlit-diner/catalog.json'),true);$GLOBALS['dyws_config']=['tracking_secret'=>str_repeat('a',64)];$store=new Store($path,$catalog);$checks=0;
function check($condition,$message){global $checks;if(!$condition)throw new RuntimeException($message);$checks++;}
function rejects(callable $f,int $code){try{$f();throw new RuntimeException('Expected rejection');}catch(ApiError $e){check($e->http===$code,'Wrong error '.$e->getMessage());}}
check(Store::formatPhone('7805550142')==='(780) 555-0142','North American phone numbers use the display format');
check(Store::formatPhone('+44 2071234567')==='+44 2071234567','International numbers are preserved');
function order(array $changes=[]):array{return array_replace_recursive(['idempotencyKey'=>bin2hex(random_bytes(16)),'customer'=>['name'=>'Test Guest','phone'=>'7805550142'],'lines'=>[['id'=>'breakfast0','variant'=>'','quantity'=>2,'price'=>1]],'fulfillment'=>'delivery','address'=>'15320 Fictional Lane, Edmonton','notes'=>'Test only'],$changes);}
try {
 $body=order();$receipt=$store->create($body);$id=$receipt['id'];$token=$receipt['trackingToken'];
 check($receipt['total']===3554,'Authoritative total includes 2990 subtotal, 395 delivery and 169 tax');
 $same=$store->create($body);check($same===$receipt,'Idempotent retry returns original order and tracking token');check(count($store->orders())===1,'No duplicate order');
 $changed=$body;$changed['customer']['name']='Different';rejects(fn()=>$store->create($changed),409);
 rejects(fn()=>$store->create(order(['lines'=>[['id'=>'missing','quantity'=>1]]])),422);
 rejects(fn()=>$store->create(order(['lines'=>[['id'=>'sweet1','variant'=>'invalid','quantity'=>1]]])),422);
 rejects(fn()=>$store->tracking($id,'wrong-token'),404);
 check(!isset($store->tracking($id,$token)['customer_name']),'Public tracking excludes personal details');
 $tracked=$store->tracking($id,$token);$summary=$tracked['summary'];
 check($summary['subtotal']===2990&&$summary['deliveryFee']===395&&$summary['tax']===169&&$summary['total']===3554&&$summary['currency']==='CAD','Private receipt uses authoritative saved totals');
 check(array_keys($summary['lines'][0])===['name','option','price','quantity']&&$summary['lines'][0]['quantity']===2&&$summary['lines'][0]['price']===1495,'Receipt exposes only whitelisted line fields');
 check($tracked['business']['pickupAddress']===$catalog['pickupAddress']&&is_int($tracked['createdAt']),'Tracking includes business pickup details and creation time');
 $changedCatalog=$catalog;$changedCatalog['categories'][0]['items'][0]['price']=1;$changedStore=new Store($path,$changedCatalog);check($changedStore->tracking($id,$token)['summary']===$summary,'Catalog price changes cannot rewrite the receipt');unset($changedStore);
 rejects(fn()=>$store->change($id,'delivered','manager'),409);
 $store->assign($id,'driver-one');$store->change($id,'accepted','manager');$store->change($id,'preparing','manager');$store->change($id,'ready','manager');
 rejects(fn()=>$store->change($id,'out_for_delivery','driver','driver-two'),403);
 $store->change($id,'out_for_delivery','driver','driver-one');
 $gps=['latitude'=>53.61665,'longitude'=>-113.39804,'accuracy'=>8,'recordedAt'=>time()];
 rejects(fn()=>$store->locate($id,'driver-two',$gps),403);
 rejects(fn()=>$store->locate($id,'driver-one',array_replace($gps,['latitude'=>91])),422);
 rejects(fn()=>$store->locate($id,'driver-one',array_replace($gps,['recordedAt'=>time()-500])),422);
 $store->locate($id,'driver-one',$gps);check($store->tracking($id,$token)['location']!==null,'GPS visible on active delivery');
 rejects(fn()=>$store->locate($id,'driver-one',$gps),409);
 rejects(fn()=>$store->change($id,'delivered','driver','driver-one'),409);
 $store->payment($id,'capture');rejects(fn()=>$store->payment($id,'capture'),409);
 $report=$store->reports(time()-60,time()+60);check($report['captured']===3554&&$report['netCollected']===3554,'Payment report');check($report['netSales']+$report['netTax']+$report['netDeliveryFees']===$report['netCollected'],'Report reconciles');
 $store->change($id,'delivered','driver','driver-one');check($store->tracking($id,$token)['location']===null,'GPS removed on delivery');rejects(fn()=>$store->locate($id,'driver-one',array_replace($gps,['recordedAt'=>time()+1])),403);
 $store->payment($id,'refund');rejects(fn()=>$store->payment($id,'refund'),409);check($store->reports(time()-60,time()+60)['netCollected']===0,'Refund reduces collection once');
 $other=new Store($path,$catalog,'other-restaurant');check(count($other->orders())===0,'Tenant order isolation');rejects(fn()=>$other->get($id),404);rejects(fn()=>$other->tracking($id,$token),404);check($other->reports(time()-60,time()+60)['orderCount']===0,'Tenant report isolation');
 $store->execute('UPDATE orders SET tracking_expires=? WHERE id=?',[time()-1,$id]);rejects(fn()=>$store->tracking($id,$token),404);
 $pending=$store->create(order());$store->execute('UPDATE orders SET created_at=1 WHERE id=?',[$pending['id']]);
 for($n=0;$n<201;$n++){$history=$store->create(order());$store->execute("UPDATE orders SET status='cancelled' WHERE id=?",[$history['id']]);}
 $board=$store->orders();check(count($board)===200,'Order board remains bounded');check($board[0]['id']===$pending['id'],'An older active order remains ahead of more than 200 newer finished orders');
 $store->execute("UPDATE orders SET status='placed',fulfillment_meta_json=? WHERE tenant=? AND status='cancelled'",[json_encode(['version'=>1,'type'=>'scheduled_pickup','label'=>'Scheduled pickup','scheduled'=>true,'scheduledAt'=>time()+86400]),$store->tenant]);
 check($store->orders()[0]['id']===$pending['id'],'Due work survives the 200 row bound ahead of future scheduled orders');
 check(count($other->orders())===0,'Active first selection remains tenant scoped');
 echo "Backend: $checks checks passed.\n";
}finally {unset($other,$store);foreach([$path,$path.'-wal',$path.'-shm']as $f)if(is_file($f))unlink($f);}
