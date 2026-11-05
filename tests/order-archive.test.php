<?php
declare(strict_types=1);
require __DIR__.'/../modules/dyws/php/module.php';
use dyws\{Catalog,Store,OrderArchive,DriverOrders,StatusHistory,Entitlements,ApiError};
$dir=sys_get_temp_dir().'/dyws-archive-'.bin2hex(random_bytes(6));mkdir($dir,0700);$checks=0;
$GLOBALS['dyws_config']=['tracking_secret'=>str_repeat('a',64)];
function verify(bool $ok,string $message):void{global $checks;if(!$ok)throw new RuntimeException($message);$checks++;}
function denied(callable $fn,int $code):void{try{$fn();throw new RuntimeException('Expected rejection');}catch(ApiError $e){verify($e->http===$code,$e->getMessage());}}
try{
 $catalog=Catalog::load(__DIR__.'/../examples/starlit-diner/catalog.json');$store=new Store($dir.'/orders.sqlite',$catalog,'archive-review');$archive=new OrderArchive($store);$manager=['role'=>'manager','subject'=>'manager'];$driver=['role'=>'driver','subject'=>'driver-a'];
 $body=['idempotencyKey'=>bin2hex(random_bytes(16)),'customer'=>['name'=>'Fictional Archive Guest','phone'=>'7805550142'],'fulfillment'=>'delivery','address'=>'100 Fictional Street','notes'=>'Private fixture note','lines'=>[['id'=>'breakfast0','variant'=>'','quantity'=>1]],'demoAcknowledged'=>true];
 $order=$store->create($body);$id=$order['id'];
 denied(fn()=>$archive->apply($id,$manager,['archived'=>true]),409);denied(fn()=>$archive->apply($id,$manager,['archived'=>'true']),422);denied(fn()=>$archive->apply($id,['role'=>'customer'],['archived'=>true]),403);
 $store->db->exec(file_get_contents(__DIR__.'/../modules/dyws/php/accounts.sql'));foreach(['driver-a','driver-b'] as $d)$store->execute('INSERT INTO drivers(tenant,id,name,password_hash,active) VALUES(?,?,?,?,1)',[$store->tenant,$d,$d,'fixture']);$store->assign($id,'driver-a');$store->payment($id,'capture');foreach(['accepted','preparing','ready','out_for_delivery','delivered'] as $status)$store->change($id,$status,'manager');
 $before=$store->get($id);$tracking=$store->tracking($id,$order['trackingToken']);$payments=$store->query('SELECT * FROM payments');$events=$store->query('SELECT * FROM events');
 verify(count(DriverOrders::history($store,'driver-a'))===1,'Completed assignment remains available');verify(DriverOrders::history($store,'driver-b')===[],'Other driver excluded');$history=DriverOrders::history($store,'driver-a')[0];foreach(['customer_name','customer_phone','address','notes','gps','trackingToken','pluginData'] as $private)verify(!array_key_exists($private,$history),'History omits '.$private);
 denied(fn()=>$archive->apply($id,['role'=>'driver','subject'=>'driver-b'],['archived'=>true]),404);
 $archive->apply($id,$driver,['archived'=>true]);verify(DriverOrders::history($store,'driver-a')===[],'Archived driver assignment hidden');verify(DriverOrders::history($store,'driver-a',200,true)[0]['id']===$id,'Driver can review own archive');verify(count($archive->managerOrders())===1,'Driver archive leaves Admin visible');
 $archive->apply($id,$manager,['archived'=>true]);verify($archive->managerOrders()===[],'Admin archive hides normal list');verify($archive->managerOrders(true)[0]['archived'],'Admin archive available');$archive->apply($id,$manager,['archived'=>true]);verify(count($store->query('SELECT * FROM order_archive_edits'))===2,'Retries do not duplicate audit');
 verify($store->get($id)===$before,'Archive does not edit order records');verify($store->query('SELECT * FROM payments')===$payments,'Payment ledger preserved');verify($store->query('SELECT * FROM events')===$events,'Status history unchanged');verify($store->tracking($id,$order['trackingToken'])===$tracking,'Customer tracking unchanged');
 $archive->apply($id,$manager,['archived'=>false]);verify(count($archive->managerOrders())===1,'Admin can restore without restoring driver view');verify(DriverOrders::history($store,'driver-a')===[],'Driver preference remains independent');
 $sh=new StatusHistory($store);$state=$sh->summary($id);$sh->apply($id,['action'=>'set','status'=>'ready','revision'=>$state['revision']]);verify(count($store->orders('driver-a'))===1,'Reopened order visible in active assignments');$store->change($id,'out_for_delivery','manager');$store->change($id,'delivered','manager');verify(count(DriverOrders::history($store,'driver-a'))===1,'A later completion does not revive an old archive');
 $other=new Store($dir.'/orders.sqlite',$catalog,'another-tenant');denied(fn()=>(new OrderArchive($other))->apply($id,$manager,['archived'=>true]),404);verify(DriverOrders::history($other,'driver-a')===[],'History tenant isolation');denied(fn()=>DriverOrders::history($store,'driver-a',201),422);
 verify(Entitlements::summary(['pricing_tier'=>'free'])['capabilities']['reports']===false,'Free has no reports');denied(fn()=>Entitlements::requireReports(['pricing_tier'=>'free']),403);denied(fn()=>Entitlements::requireReports(['pricing_tier'=>'unknown']),403);Entitlements::requireReports(['pricing_tier'=>'pro']);verify(true,'Pro includes reports');
 echo "Order archive and tiers: $checks assertions passed.\n";
}finally{unset($archive,$sh,$other,$store);foreach(glob($dir.'/*') as $file)unlink($file);rmdir($dir);}
