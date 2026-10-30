<?php
declare(strict_types=1);
require_once __DIR__.'/../server/bootstrap.php';
require_once __DIR__.'/../plugins/delivery/Runs.php';
require __DIR__.'/../server/Store.php';
require_once __DIR__.'/../modules/dyws/php/Realtime.php';
use dyws\Store;use dyws\ApiError;use dyws\Plugins\Delivery\Runs as DeliveryRuns;
$path=tempnam(sys_get_temp_dir(),'dyws-runs-');$catalog=json_decode(file_get_contents(__DIR__.'/../examples/starlit-diner/catalog.json'),true);$GLOBALS['dyws_config']=['tracking_secret'=>str_repeat('a',64)];$s=new Store($path,$catalog);$runs=new DeliveryRuns($s);$checks=0;
function ok($condition,$message){global $checks;if(!$condition)throw new RuntimeException($message);$checks++;}
function rejects(callable $fn,int $status){try{$fn();throw new RuntimeException('Expected rejection');}catch(ApiError $e){ok($e->http===$status,'Unexpected error '.$e->getMessage());}}
function ready(bool $paid=true,string $fulfillment='delivery'):array {global $s;$r=$s->create(['idempotencyKey'=>bin2hex(random_bytes(16)),'customer'=>['name'=>'Test Guest','phone'=>'7805550142'],'lines'=>[['id'=>'breakfast0','quantity'=>1]],'fulfillment'=>$fulfillment,'address'=>bin2hex(random_bytes(4)).' Fictional Lane']);foreach(['accepted','preparing','ready']as $state)$s->change($r['id'],$state,'manager');if($paid)$s->payment($r['id'],'capture');return $r;}
try {
 $a=ready();$b=ready(false);$c=ready();$pickup=ready(true,'pickup');$ids=[$a['id'],$b['id']];$key=bin2hex(random_bytes(16));
 rejects(fn()=>$runs->create('one',[$pickup['id']],bin2hex(random_bytes(16))),409);
 rejects(fn()=>$runs->create('one',[$a['id'],$a['id']],$key),422);
 $r=$runs->create('one',$ids,$key);$id=$r['id'];ok($r['orderIds']===$ids,'Stop ordering persisted');ok($runs->create('one',$ids,$key)['id']===$id,'Retry is idempotent');
 rejects(fn()=>$runs->create('one',[$c['id']],$key),409);
 rejects(fn()=>$runs->create('one',[$c['id']],bin2hex(random_bytes(16))),409);
 rejects(fn()=>$runs->create('two',[$a['id']],bin2hex(random_bytes(16))),409);
 rejects(fn()=>$s->assign($a['id'],'two'),409);rejects(fn()=>$s->change($a['id'],'cancelled','manager'),409);
 rejects(fn()=>$s->change($a['id'],'out_for_delivery','driver:one','one'),409);
 rejects(fn()=>$runs->start($id,'two'),403);rejects(fn()=>$runs->start($id,'one'),409);
 ok($s->get($a['id'])['status']==='ready'&&$s->get($b['id'])['status']==='ready','Failed batch start rolls back already started stops');
 $s->payment($b['id'],'capture');$r=$runs->edit($id,['action'=>'reorder','orderIds'=>array_reverse($ids),'revision'=>1]);
 rejects(fn()=>$runs->edit($id,['action'=>'cancel','revision'=>1]),409);
 rejects(fn()=>$runs->edit($id,['action'=>'reorder','orderIds'=>[$a['id'],$a['id']],'revision'=>2]),422);
 $r=$runs->start($id,'one');ok($r['nextOrderId']===$b['id'],'Starts in chosen stop order');ok($runs->start($id,'one')['status']==='active','Retry start is safe');
 $s->assign($c['id'],'one');rejects(fn()=>$s->change($c['id'],'out_for_delivery','driver:one','one'),409);
 $session=['subject'=>'one','token_hash'=>str_repeat('a',64),'expires_at'=>time()+300];$s->execute("INSERT INTO sessions VALUES(?,?,'driver','one',?)",[$session['token_hash'],$s->tenant,$session['expires_at']]);
 rejects(fn()=>$runs->location($id,array_replace($session,['subject'=>'two']),'start',[]),403);
 $lease=$runs->location($id,$session,'start',['source'=>'device']);$gps=['latitude'=>53.61665,'longitude'=>-113.39804,'accuracy'=>8,'recordedAt'=>time(),'sharingToken'=>$lease['sharingToken']];
 $runs->location($id,$session,'update',$gps);
 foreach([$a,$b] as $o)ok($s->tracking($o['id'],$o['trackingToken'])['location']['latitude']===$gps['latitude'],'One upload updates every active customer');
 $private=$s->tracking($a['id'],$a['trackingToken']);ok($private['deliveryRun']===['stopsAhead'=>1,'isNext'=>false],'Customer knows stops ahead');ok(!str_contains(json_encode($private),$b['id'])&&!str_contains(json_encode($private),$s->get($b['id'])['address']),'No other customer details leaked');
 // A failure at a later stop must roll back an earlier GPS write in the same upload.
 $s->execute('UPDATE location_shares SET sharing_hash=? WHERE tenant=? AND order_id=?',['invalid',$s->tenant,$a['id']]);
 rejects(fn()=>$runs->location($id,$session,'update',array_replace($gps,['recordedAt'=>$gps['recordedAt']+1])),403);
 ok($s->locationSummary($b['id'])['recordedAt']===$gps['recordedAt'],'GPS fanout rolls back if a remaining lease is invalid');
 $s->execute('UPDATE location_shares SET sharing_hash=? WHERE tenant=? AND order_id=?',[hash('sha256',$lease['sharingToken']),$s->tenant,$a['id']]);
 rejects(fn()=>$runs->location($id,$session,'update',$gps),409);
 rejects(fn()=>$runs->location($id,$session,'heartbeat',['sharingToken'=>'wrong']),403);
 $runs->location($id,$session,'stop',['sharingToken'=>'old-token']);ok($s->locationSummary($a['id'])['sharing'],'Old tab cannot stop current share');
 rejects(fn()=>$s->change($a['id'],'delivered','driver:one','one'),409);
 $rt=new dyws\Realtime([],$s);$before=$rt->access('tracking',null,$a['id'])['revision'];
 $result=$s->change($b['id'],'delivered','driver:one','one');$rt->mutation('/driver/orders/'.$b['id'].'/status',$result);
 ok($before!==$rt->access('tracking',null,$a['id'])['revision'],'Completing a stop invalidates remaining customer tracking');
 ok($s->tracking($b['id'],$b['trackingToken'])['location']===null,'Completed customer no longer receives GPS');
 ok($s->tracking($a['id'],$a['trackingToken'])['deliveryRun']['isNext'],'Next customer advances automatically');
 $runs->location($id,$session,'heartbeat',['sharingToken'=>$lease['sharingToken']]);$gps['recordedAt']++;$runs->location($id,$session,'update',$gps);
 ok($s->tracking($a['id'],$a['trackingToken'])['location']['recorded_at']===$gps['recordedAt'],'Original GPS lease survives a completed stop');
 $s->change($a['id'],'delivered','driver:one','one');ok($runs->get($id)['status']==='completed','Last stop completes run');ok(!$runs->listing('one'),'Finished run leaves active board');
 ok(!$s->query('SELECT * FROM locations')&&!$s->query('SELECT * FROM location_shares'),'All GPS removed at completion');
 rejects(fn()=>$runs->location($id,$session,'update',$gps),403);
 $next=$runs->create('one',[$c['id']],bin2hex(random_bytes(16)));$runs->edit($next['id'],['action'=>'cancel','revision'=>1]);$s->assign($c['id'],'two');ok(!$runs->membership($c['id']),'Cancelling frees planned orders without cancelling them');
 $other=new Store($path,$catalog,'other');rejects(fn()=>(new DeliveryRuns($other))->get($id),404);ok(!(new DeliveryRuns($other))->listing(),'Tenant run isolation');
 // Failed nested work cannot commit a partially written batch.
 try{$s->transaction(function()use($s){$s->execute("UPDATE orders SET notes='rolled back'");$s->transaction(fn()=>throw new RuntimeException('rollback'));});}catch(RuntimeException $e){}
 ok(!$s->query("SELECT id FROM orders WHERE notes='rolled back'"),'Nested transaction rollback is atomic');
 echo "Delivery runs: $checks checks passed.\n";
}finally{unset($other,$s,$runs);foreach([$path,$path.'-wal',$path.'-shm'] as $f)if(is_file($f))unlink($f);}
