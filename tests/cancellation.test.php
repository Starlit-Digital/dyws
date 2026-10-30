<?php
declare(strict_types=1);
require_once __DIR__.'/../server/bootstrap.php';
require_once __DIR__.'/../plugins/delivery/Runs.php';
require_once __DIR__.'/../server/bootstrap.php';
use dyws\{Store,Catalog,Cancellation,ApiError};
use dyws\Plugins\Delivery\Runs as DeliveryRuns;
$dir=sys_get_temp_dir().'/dyws-cancel-'.bin2hex(random_bytes(6));mkdir($dir,0700);$checks=0;
$GLOBALS['dyws_config']=['tracking_secret'=>str_repeat('x',64)];
function check($ok,string $message){global $checks;if(!$ok)throw new RuntimeException($message);$checks++;}
function rejects(callable $fn,int $code=422){try{$fn();throw new RuntimeException('Expected rejection');}catch(ApiError $e){check($e->http===$code,$e->getMessage());}}
function body(string $location='north'):array{return ['idempotencyKey'=>bin2hex(random_bytes(16)),'customer'=>['name'=>'Fictional Guest','phone'=>'7805550100'],'locationId'=>$location,'fulfillment'=>'pickup','tip'=>500,'lines'=>[['id'=>'breakfast0','variant'=>'','quantity'=>1]]];}
try{
 check(Cancellation::policy(null)===['enabled'=>false,'minutes'=>4],'Disabled default with four minutes');
 foreach([0,1441,1.5,'4',false] as $bad)rejects(fn()=>Cancellation::policy(['enabled'=>true,'minutes'=>$bad]));
 rejects(fn()=>Cancellation::policy(['enabled'=>'yes','minutes'=>4]));
 $catalog=Catalog::load(__DIR__.'/../examples/starlit-diner/catalog.json');
 $catalog['locations']=[['id'=>'north','name'=>'North','address'=>'100 Example Road','active'=>true,'customerCancellation'=>['enabled'=>true,'minutes'=>6]],['id'=>'west','name'=>'West','address'=>'200 Example Road','active'=>true]];$catalog=Catalog::validate($catalog);
 $store=new Store($dir.'/orders.sqlite',$catalog,'cancel');
 $r=$store->create(body());$id=$r['id'];$token=$r['trackingToken'];$c=$store->tracking($id,$token)['cancellation'];
 check($c['available']&&$c['minutes']===6&&$c['deadline']===$store->get($id)['created_at']+360,'Authoritative location window');
 $west=$store->create(body('west'));check(!$store->tracking($west['id'],$west['trackingToken'])['cancellation']['enabled'],'Location disabled independently');rejects(fn()=>Cancellation::cancel($store,$west['id'],$west['trackingToken']),409);
 rejects(fn()=>Cancellation::cancel($store,$id,'wrong'),404);
 $other=new Store($dir.'/orders.sqlite',$catalog,'other');rejects(fn()=>Cancellation::cancel($other,$id,$token),404);
 $store->payment($id,'capture');$store->change($id,'accepted','manager');$store->change($id,'preparing','manager');
 $edited=$catalog;$edited['locations'][0]['customerCancellation']=['enabled'=>false,'minutes'=>1];$updated=new Store($dir.'/orders.sqlite',$edited,'cancel');
 check($updated->tracking($id,$token)['cancellation']['available'],'Policy changes preserve existing promise');
 $result=Cancellation::cancel($updated,$id,$token);check($result['status']==='cancelled'&&$result['paymentStatus']==='refunded'&&$result['cancellation']['paymentState']==='refunded','Customer cancellation refunds full demo payment');
 Cancellation::cancel($updated,$id,$token);check(count($store->query("SELECT * FROM payments WHERE order_id=? AND kind='refund'",[$id]))===1,'Retry refunds exactly once');
 check(count($store->query("SELECT * FROM events WHERE order_id=? AND status='cancelled' AND actor='customer'",[$id]))===1,'Customer cancellation audited once');
 $report=$store->reports(time()-5,time()+5);check($report['netCollected']===0&&$report['refundedTips']===500,'Refund includes tip and reconciles components');
 rejects(fn()=>$store->payment($id,'capture'),409);rejects(fn()=>$store->change($id,'accepted','manager'),409);
 $expired=$store->create(body());$store->execute('UPDATE orders SET created_at=? WHERE id=?',[time()-360,$expired['id']]);rejects(fn()=>Cancellation::cancel($store,$expired['id'],$expired['trackingToken']),409);
 $o=$store->get($expired['id']);check(!Cancellation::summary($o,$o['created_at']+360)['available']&&Cancellation::summary($o,$o['created_at']+359)['available'],'Exact deadline boundary');
 $old=$store->create(body());$store->execute('UPDATE orders SET tracking_expires=? WHERE id=?',[time()-1,$old['id']]);rejects(fn()=>Cancellation::cancel($store,$old['id'],$old['trackingToken']),404);
 $unpaid=$store->create(body());$cancelled=Cancellation::cancel($store,$unpaid['id'],$unpaid['trackingToken']);check($cancelled['cancellation']['paymentState']==='not_charged'&&$cancelled['paymentStatus']==='unpaid','Unpaid order creates no refund');
 $forged=body('west');$forged['cancellation_window_minutes']=999;$forged['customerCancellation']=['enabled'=>true,'minutes'=>999];$r=$store->create($forged);check(!$store->tracking($r['id'],$r['trackingToken'])['cancellation']['available'],'Browser cannot set cancellation window');
 $deliveries=[];foreach(range(1,2) as $n){$b=body();$b['fulfillment']='delivery';$b['address']='100 Fictional Street';$r=$store->create($b);$deliveries[]=$r;foreach(['accepted','preparing','ready'] as $state)$store->change($r['id'],$state,'manager');$store->payment($r['id'],'capture');}
 $runs=new DeliveryRuns($store);$run=$runs->create('driver',array_column($deliveries,'id'),bin2hex(random_bytes(16)));Cancellation::cancel($store,$deliveries[0]['id'],$deliveries[0]['trackingToken']);
 $after=$runs->get($run['id']);check($after['orderIds']===[$deliveries[1]['id']]&&$after['stops'][0]['position']===1&&$after['revision']>$run['revision'],'Cancellation removes only its planned stop and revises run');
 $runs->start($run['id'],'driver');rejects(fn()=>Cancellation::cancel($store,$deliveries[1]['id'],$deliveries[1]['trackingToken']),409);
 // New columns are additive and old orders do not acquire a cancellation promise.
 $legacy=new Store($dir.'/legacy.sqlite',$catalog,'legacy');$r=$legacy->create(body());$before=$legacy->get($r['id']);
 foreach(['cancellation_window_minutes','customer_cancelled_at','cancellation_payment_state'] as $column)$legacy->db->exec('ALTER TABLE orders DROP COLUMN '.$column);unset($legacy);
 $legacy=new Store($dir.'/legacy.sqlite',$catalog,'legacy');$after=$legacy->get($r['id']);check($after['total']===$before['total']&&$after['cancellation_window_minutes']===0,'Migration preserves old order totals and policy');
 $r=$store->create(body());$changed=null;Cancellation::cancel($store,$r['id'],$r['trackingToken'],$changed);check($changed===true,'First cancellation emits transition');Cancellation::cancel($store,$r['id'],$r['trackingToken'],$changed);check($changed===false,'Duplicate cancellation does not repeat observation hooks');
 echo "Customer cancellation: $checks checks passed.\n";
}finally{unset($store,$updated,$other,$legacy);foreach(glob($dir.'/*') as $file)unlink($file);rmdir($dir);}
