<?php
declare(strict_types=1);
require __DIR__.'/../modules/dyws/php/module.php';
use dyws\{Store,Catalog,ApiError,Cancellation};
$dir=sys_get_temp_dir().'/dyws-door-'.bin2hex(random_bytes(6));mkdir($dir,0700);$checks=0;
function check($ok,$message){global $checks;if(!$ok)throw new RuntimeException($message);$checks++;}
function rejects(callable $fn,int $status=422){try{$fn();throw new RuntimeException('Expected rejection');}catch(ApiError $e){check($e->http===$status,$e->getMessage());}}
function body():array{return ['idempotencyKey'=>bin2hex(random_bytes(16)),'customer'=>['name'=>'Example Customer','phone'=>'7805550142'],'fulfillment'=>'delivery','address'=>'123 Example Avenue','paymentMethod'=>'pay_at_door','lines'=>[['id'=>'notebook','quantity'=>1]]];}
try{
 $GLOBALS['dyws_config']=['tracking_secret'=>str_repeat('a',64)];$catalog=Catalog::load(__DIR__.'/../examples/general-store/catalog.json');
 check(!$catalog['allowPayAtDoor'],'Door payment defaults off');
 foreach(['true',1,null] as $invalid){$bad=$catalog;$bad['allowPayAtDoor']=$invalid;rejects(fn()=>Catalog::validate($bad));}
 $off=new Store($dir.'/orders.sqlite',$catalog,'off');rejects(fn()=>$off->create(body(),'stripe'));
 $catalog['allowPayAtDoor']=true;$catalog['customerCancellation']=['enabled'=>true,'minutes'=>4];$store=new Store($dir.'/orders.sqlite',$catalog,'door');
 $pickup=body();$pickup['fulfillment']='pickup';rejects(fn()=>$store->create($pickup));
 $invalid=body();$invalid['paymentMethod']='fake';rejects(fn()=>$store->create($invalid));
 $order=body();$receipt=$store->create($order,'stripe');$id=$receipt['id'];check($receipt['paymentProvider']==='pay-at-door'&&$receipt['paymentMethod']==='pay_at_door','Door bypasses online provider');check($store->get($id)['payment_status']==='unpaid','Door starts unpaid');
 check($store->create($order,'stripe')['id']===$id,'Door retries are idempotent');$changed=$order;$changed['paymentMethod']='pay_now';rejects(fn()=>$store->create($changed,'stripe'),409);
 check(!$store->query('SELECT * FROM payment_attempts'),'No online checkout attempt created');
 $cancel=body();$cancelReceipt=$store->create($cancel,'stripe');$tracking=Cancellation::cancel($store,$cancelReceipt['id'],$cancelReceipt['trackingToken']);check($tracking['cancellation']['paymentState']==='not_charged','Unpaid door cancellation needs no refund');check(!$store->query('SELECT * FROM cancellation_jobs'),'Door cancellation queues no provider job');
 foreach(['accepted','preparing','ready'] as $status)$store->change($id,$status,'manager');
 rejects(fn()=>$store->payment($id,'capture'),409);
 $store->assign($id,'driver');$store->change($id,'out_for_delivery','driver:driver','driver');
 rejects(fn()=>$store->change($id,'delivered','driver:driver','driver'),409);
 rejects(fn()=>$store->collectDoorPayment($id,'other'),403);$store->collectDoorPayment($id,'driver');check($store->get($id)['payment_status']==='paid','Assigned driver records collection');
 rejects(fn()=>$store->collectDoorPayment($id,'driver'),409);check(count($store->query('SELECT * FROM payments WHERE order_id=?',[$id]))===1,'Repeated collection cannot duplicate ledger');
 $store->change($id,'delivered','driver:driver','driver');check($store->get($id)['status']==='delivered','Paid door delivery completes');
 check($store->query("SELECT status FROM events WHERE order_id=? AND status='offline_payment_capture'",[$id]),'Collection has a distinct audit event');
 $counter=body();$counter['fulfillment']='pickup';$counter['paymentMethod']='pay_at_restaurant';$counter['idempotencyKey']=bin2hex(random_bytes(16));rejects(fn()=>$store->create($counter));
 $catalog['allowPayAtPickup']=true;$counterStore=new Store($dir.'/orders.sqlite',$catalog,'counter');$pickup=$counterStore->create($counter,'stripe');check($pickup['paymentProvider']==='pay-at-restaurant'&&$pickup['paymentMethod']==='pay_at_restaurant','Pickup can use its independently enabled payment option');
 $wrong=body();$wrong['paymentMethod']='pay_at_restaurant';rejects(fn()=>$counterStore->create($wrong));
 foreach(['accepted','preparing','ready'] as $state)$counterStore->change($pickup['id'],$state,'manager');rejects(fn()=>$counterStore->change($pickup['id'],'completed','manager'),409);$counterStore->payment($pickup['id'],'capture');$counterStore->change($pickup['id'],'completed','manager');check($counterStore->get($pickup['id'])['payment_status']==='paid','Counter collection required before pickup completion');
 $counter['idempotencyKey']=bin2hex(random_bytes(16));$cancelPickup=$counterStore->create($counter);$counterStore->payment($cancelPickup['id'],'capture');$cancelled=Cancellation::cancel($counterStore,$cancelPickup['id'],$cancelPickup['trackingToken']);check($cancelled['cancellation']['paymentState']==='attention','Cash collection requires a staff recorded refund after cancellation');$counterStore->payment($cancelPickup['id'],'refund');check($counterStore->tracking($cancelPickup['id'],$cancelPickup['trackingToken'])['cancellation']['paymentState']==='refunded','Staff can record the completed counter refund');unset($counterStore);
 echo "Door payments: $checks checks passed.\n";
}finally{unset($store,$off);foreach(glob($dir.'/*') as $p)unlink($p);rmdir($dir);}
