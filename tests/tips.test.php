<?php
declare(strict_types=1);
require __DIR__.'/../server/Store.php';
require __DIR__.'/../plugins/order-reporting/OrderReports.php';
use dyws\{Store,Tips,ApiError};
use dyws\Plugins\OrderReporting\OrderReports;
$path=tempnam(sys_get_temp_dir(),'dyws-tips-');$catalog=json_decode(file_get_contents(__DIR__.'/../examples/starlit-diner/catalog.json'),true);$GLOBALS['dyws_config']=['tracking_secret'=>str_repeat('t',64)];$store=new Store($path,$catalog);$checks=0;
function check($ok,$message){global $checks;if(!$ok)throw new RuntimeException($message);$checks++;}
function rejects($fn,$code=422){try{$fn();throw new RuntimeException('Expected rejection');}catch(ApiError $e){check($e->http===$code,$e->getMessage());}}
function body($tip=500){return ['idempotencyKey'=>bin2hex(random_bytes(16)),'tip'=>$tip,'customer'=>['name'=>'Fictional Guest','phone'=>'7805550100'],'fulfillment'=>'delivery','address'=>'100 Example Street','lines'=>[['id'=>'breakfast0','variant'=>'','quantity'=>1]],'total'=>1];}
function delivered($store,$id,$driver='one'){$store->assign($id,$driver);foreach(['accepted','preparing','ready','out_for_delivery'] as $state)$store->change($id,$state,'manager');$store->payment($id,'capture');$store->change($id,'delivered','driver',$driver);}
try{
 $plain=body(0);$old=$store->create($plain);unset($plain['tip']);check($store->create($plain)===$old,'Omitted and zero tips preserve old idempotency fingerprints');
 foreach([-100,1,150,1.5,'500',true,null,[],100000000,PHP_INT_MAX] as $bad)rejects(fn()=>$store->create(body($bad)));
 $input=body();$receipt=$store->create($input);$id=$receipt['id'];$order=$store->get($id);
 check($receipt['total']===$old['total']+500&&$receipt['tip']===500,'Tip is included exactly once and browser total is ignored');
 check($order['tax']===$store->get($old['id'])['tax'],'Tip does not increase configured tax');
 check($store->create($input)===$receipt,'Tip retry creates no duplicate');$input['tip']=600;rejects(fn()=>$store->create($input),409);
 check($store->tracking($id,$receipt['trackingToken'])['summary']['tip']===500,'Customer receipt separates tip');
 check($store->driverTips('one')['currencies']===[],'Unassigned unpaid tip is not earnings');
 $store->assign($id,'previous');$store->assign($id,'one');delivered($store,$id);
 check($store->driverTips('previous')['currencies']===[],'Previous driver earns no tip');
 check($store->driverTips('one')['currencies'][0]['periods']['allTime']['net']===500,'Completed paid delivery earns tip');
 rejects(fn()=>$store->assign($id,'two'),409);
 $r=$store->reports(time()-60,time()+60);check($r['capturedTips']===500&&$r['netTips']===500,'Core reports separate tips');
 check($r['netSales']+$r['netTax']+$r['netDeliveryFees']+$r['netTips']===$r['netCollected'],'Core components reconcile');
 // Every cent of a tipped partial refund is nonnegative; successive deltas end exactly at the original components.
 $previous=['tip'=>0,'subtotal'=>0,'tax'=>0,'delivery_fee'=>0];$monotone=true;
 for($amount=1;$amount<=$order['total'];$amount++){$parts=Tips::allocate($order,$amount);foreach($parts as $key=>$part)$monotone=$monotone&&$part>=$previous[$key];if(array_sum($parts)!==$amount)throw new RuntimeException('Allocation does not reconcile');$previous=$parts;}
 check($monotone,'Refund component allocations grow monotonically');foreach($previous as $key=>$part)check($part===$order[$key],'Full refund restores '.$key);
 $store->payment($id,'refund');$r=$store->reports(time()-60,time()+60);check($r['refundedTips']===500&&$r['netTips']===0,'Full refund reverses tip');
 $earned=$store->driverTips('one')['currencies'][0]['periods']['allTime'];check($earned===['gross'=>500,'refunded'=>500,'net'=>0,'orders'=>1],'Driver sees gross, refunds and retained earnings');
 // Historical calendar boundaries are based on completion, including a DST transition.
 $stamp=fn($date)=>(new DateTimeImmutable($date,new DateTimeZone('America/Edmonton')))->getTimestamp();
 foreach([['2026-03-08 23:59:59',100,'CAD'],['2026-03-09 00:00:00',200,'CAD'],['2026-02-28 23:59:59',300,'CAD'],['2025-12-31 23:59:59',400,'CAD'],['2026-03-09 01:00:00',700,'USD']] as [$date,$tip,$currency]){
  $r=$store->create(body($tip));delivered($store,$r['id'],'calendar');$store->execute("UPDATE events SET created_at=? WHERE order_id=? AND status='delivered'",[$stamp($date),$r['id']]);$store->execute('UPDATE orders SET currency=? WHERE id=?',[$currency,$r['id']]);
 }
 $calendar=$store->driverTips('calendar',$stamp('2026-03-09 12:00:00'));$groups=array_column($calendar['currencies'],null,'currency');$periods=$groups['CAD']['periods'];
 check($periods['today']['net']===200&&$periods['week']['net']===200&&$periods['month']['net']===300&&$periods['year']['net']===600&&$periods['allTime']['net']===1000,'Calendar periods use completion date in business timezone');
 check($groups['USD']['periods']['allTime']['net']===700,'Currencies never mix');
 check(count($groups['CAD']['daily'])===4&&count($groups['CAD']['monthly'])===3,'Historical daily and monthly summaries retained');
 for($n=0;$n<205;$n++){$r=$store->create(body(100));delivered($store,$r['id'],'history');}
 $history=$store->driverTips('history');check($history['currencies'][0]['periods']['allTime']['net']===20500&&$history['currencies'][0]['periods']['allTime']['orders']===205,'Earnings include more than 200 completed orders');check(count($history['recentOrders'])===50,'Recent order detail is bounded separately from lifetime totals');
 $other=new Store($path,$catalog,'other');check($other->driverTips('calendar')['currencies']===[],'Tenant isolation');check($store->driverTips('unassigned')['currencies']===[],'Driver isolation');
 $json=json_encode($calendar);check(!str_contains($json,'Fictional Guest')&&!str_contains($json,'7805550100'),'Earnings exclude customer contacts');
 [$from,$to]=OrderReports::range(['from'=>date('Y-m-d',time()-86400),'to'=>date('Y-m-d',time()+86400)]);$report=(new OrderReports($store))->dashboard($from,$to,'CAD')['current'];
 check(array_sum(array_column($report['daily'],'netTips'))===$report['summary']['netTips'],'Daily tips reconcile to report totals');
 check($report['summary']['netSales']+$report['summary']['netTax']+$report['summary']['netDeliveryFees']+$report['summary']['netTips']===$report['summary']['netCollected'],'Plugin payment components reconcile');
 // Existing installations receive zero defaults without rewriting historical totals.
 $legacy=tempnam(sys_get_temp_dir(),'dyws-tip-upgrade-');$migration=new Store($legacy,$catalog);$before=$migration->create(body(0));$migration->db->exec('ALTER TABLE orders DROP COLUMN tip; ALTER TABLE payment_refund_deltas DROP COLUMN tip');unset($migration);
 $migration=new Store($legacy,$catalog);check($migration->get($before['id'])['tip']===0&&$migration->get($before['id'])['total']===$before['total'],'Additive migration preserves historical orders');unset($migration);
 foreach([$legacy,$legacy.'-wal',$legacy.'-shm'] as $file)if(is_file($file))unlink($file);
 echo "Tips: $checks checks passed.\n";
}finally{unset($store,$other);foreach([$path,$path.'-wal',$path.'-shm'] as $file)if(is_file($file))unlink($file);}
