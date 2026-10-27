<?php
declare(strict_types=1);
require __DIR__.'/../server/bootstrap.php';
require __DIR__.'/../plugins/order-printer/PrinterService.php';
use dyws\{Catalog,Store,ApiError};
use dyws\Plugins\OrderPrinter\PrinterService;
$dir=sys_get_temp_dir().'/dyws-printer-'.bin2hex(random_bytes(6));mkdir($dir,0700);
$GLOBALS['dyws_config']=['tracking_secret'=>str_repeat('x',64)];$checks=0;
function check(bool $ok):void{global $checks;if(!$ok)throw new RuntimeException('Check '.($checks+1).' failed');$checks++;}
function rejects(callable $fn,int $code=422):void{try{$fn();throw new RuntimeException('Expected rejection');}catch(ApiError $e){check($e->http===$code);}}
try{
 $catalog=Catalog::load(__DIR__.'/../examples/starlit-diner/catalog.json');
 $catalog['locations']=[['id'=>'north','name'=>'North','address'=>'100 Example Road','phone'=>'7805550142','active'=>true],['id'=>'west','name'=>'West','address'=>'200 Example Road','phone'=>'','active'=>true]];
 $catalog=Catalog::validate($catalog);file_put_contents($dir.'/catalog.json',json_encode($catalog));
 $config=['catalog'=>$dir.'/catalog.json','public_base_url'=>'https://orders.example.test'];
 $store=new Store($dir.'/orders.sqlite',$catalog,'printer-test');$service=new PrinterService($config,$store);
 $make=function(string $location='north',string $provider='demo',?array $schedule=null)use($store,$catalog){return $store->create(['idempotencyKey'=>bin2hex(random_bytes(16)),'customer'=>['name'=>"Fictional Guest\x1b@",'phone'=>'7805550142'],'locationId'=>$location,'fulfillment'=>'pickup','pickupSchedule'=>$schedule,'notes'=>"No onions\x1dV\nPlease",'lines'=>[['id'=>$catalog['categories'][0]['items'][0]['id'],'quantity'=>1]]],$provider)['id'];};
 $old=$make();$store->change($old,'accepted','manager');
 rejects(fn()=>$service->createDevice(['name'=>'Kitchen','locationId'=>'unknown']));
 rejects(fn()=>$service->createDevice(['name'=>'Kitchen','locationId'=>'north','profile'=>'usb']));
 $created=$service->createDevice(['name'=>'Kitchen','locationId'=>'north','profile'=>'epson80']);$printer=$created['id'];
 check(strlen($created['enrollmentCode'])===32);$token=str_repeat('a',64);$headers=['HTTP_X_DYWS_PRINTER_TOKEN'=>$token];
 $enroll=['code'=>$created['enrollmentCode'],'token'=>$token,'deviceId'=>'test-device-001'];
 rejects(fn()=>$service->deviceRequest('poll',[],[]),401);
 rejects(fn()=>$service->enroll(array_replace($enroll,['code'=>str_repeat('b',32)])),401);
 check($service->enroll($enroll)['printerId']===$printer);
 check($service->enroll($enroll)['printerId']===$printer);
 rejects(fn()=>$service->enroll(array_replace($enroll,['token'=>str_repeat('b',64)])),409);
 $poll=fn($status='ready')=>$service->deviceRequest('poll',['status'=>$status],$headers);
 $ack=fn($j,$action)=>$service->deviceRequest('ack',['jobId'=>$j['id'],'lease'=>$j['lease'],'action'=>$action],$headers);
 check($poll()['job']===null); // Same second orders that predate configuration are not replayed.
 $id=$make();check($poll()['job']===null);$store->change($id,'accepted','manager');
 check($poll('paper_out')['job']===null);
 $job=$poll()['job'];check($job!==null);check(str_contains($job['text'],'DEMONSTRATION ORDER'));check(str_contains($job['text'],$id));
 check(!str_contains($job['text'],'7805550142'));check(!preg_match('/[\x00-\x09\x0B-\x1F\x7F]/',$job['text']));
 check($poll()['job']===null);rejects(fn()=>$ack($job,'sent'),409);
 rejects(fn()=>$ack(array_replace($job,['lease'=>str_repeat('0',48)]),'start'),409);
 check($ack($job,'start')['state']==='printing');check($ack($job,'start')['state']==='printing');
 rejects(fn()=>$ack($job,'release'),409);check($ack($job,'sent')['state']==='sent');check($ack($job,'sent')['state']==='sent');check($poll()['job']===null);
 $summary=json_encode($service->summary());check(!str_contains($summary,$token));check(!str_contains($summary,$created['enrollmentCode']));check(!str_contains($summary,'Fictional Guest'));
 // Location filtering happens before the batch limit, even after a missed observer.
 for($i=0;$i<205;$i++){$west=$make('west');$store->change($west,'accepted','manager');}
 $next=$make();$store->change($next,'accepted','manager');$job=$poll()['job'];check(str_contains($job['text'],$next));
 check($ack($job,'release')['state']==='queued');$job=$poll()['job'];
 $store->execute('UPDATE printer_jobs SET lease_until=? WHERE id=?',[time()-1,$job['id']]);
 $service->reconcileAll();check($ack($job,'uncertain')['state']==='queued');$job=$poll()['job'];
 $ack($job,'start');$store->execute('UPDATE printer_jobs SET lease_until=? WHERE id=?',[time()-1,$job['id']]);
 check($poll()['attention']===true);$jobStates=array_column($service->summary()['jobs'],'state','id');check($jobStates[$job['id']]==='uncertain');
 $copyRequest=['printerId'=>$printer,'jobId'=>$job['id'],'action'=>'reprint','requestId'=>'recovery-one'];
 $copy=$service->manage($copyRequest);check($service->manage($copyRequest)===$copy);check($ack($job,'uncertain')['state']==='cancelled');
 $copyJob=$poll()['job'];check($copyJob['id']===$copy['jobId']);check(str_starts_with($copyJob['text'],'COPY / REPRINT'));$ack($copyJob,'start');$ack($copyJob,'sent');
 // Cancellation after reservation must prevent starting physical output.
 $cancel=$make();$store->change($cancel,'accepted','manager');$job=$poll()['job'];$store->change($cancel,'cancelled','manager');rejects(fn()=>$ack($job,'start'),409);$service->reconcileAll();check($ack($job,'uncertain')['state']==='cancelled');
 // A provider order needs authoritative payment, even if bad imported state says accepted.
 $unpaid=$make('north','stripe');$store->execute("UPDATE orders SET status='accepted' WHERE id=?",[$unpaid]);check($poll()['job']===null);
 $store->execute("UPDATE orders SET payment_status='paid' WHERE id=?",[$unpaid]);$job=$poll()['job'];check(str_contains($job['text'],$unpaid));$ack($job,'start');$ack($job,'uncertain');
 check($poll()['job']===null);$service->manage(['printerId'=>$printer,'jobId'=>$job['id'],'action'=>'dismiss']);check($ack($job,'uncertain')['state']==='cancelled');
 $testRequest=['printerId'=>$printer,'action'=>'test','requestId'=>'test-once'];check($service->manage($testRequest)===$service->manage($testRequest));
 $job=$poll()['job'];check(str_contains($job['text'],'DYWS PRINTER TEST'));$ack($job,'start');$ack($job,'uncertain');
 $service->manage(['printerId'=>$printer,'jobId'=>$job['id'],'action'=>'resolve']);check($ack($job,'sent')['state']==='sent');
 $schedule=['date'=>(new DateTimeImmutable('tomorrow',new DateTimeZone('America/Edmonton')))->format('Y-m-d'),'time'=>'12:15'];
 $scheduled=$make('north','demo',$schedule);$store->change($scheduled,'accepted','manager');$job=$poll()['job'];
 check(str_contains($job['text'],'SCHEDULED PICKUP'));check(str_contains($job['text'],'PICKUP DATE: '.$schedule['date']));check(str_contains($job['text'],'PICKUP TIME: 12:15'));check(str_contains($job['text'],'America/Edmonton'));
 check($job['fulfillmentMeta']['type']==='scheduled_pickup'&&$job['fulfillmentMeta']['localDate']===$schedule['date']);check($job['orderId']===$scheduled);
 $ack($job,'start');$ack($job,'sent');
 // Both tenant boundaries and another printer's lease are enforced.
 $otherStore=new Store($dir.'/orders.sqlite',$catalog,'other-tenant');$other=new PrinterService($config,$otherStore);
 check($other->summary()['devices']===[]);rejects(fn()=>$other->deviceRequest('poll',[],$headers),401);rejects(fn()=>$other->manage(['printerId'=>$printer,'action'=>'revoke']),404);
 $second=$service->createDevice(['name'=>'Second','locationId'=>'north','profile'=>'dfrobot58']);$secondToken=str_repeat('c',64);$service->enroll(['code'=>$second['enrollmentCode'],'token'=>$secondToken,'deviceId'=>'second-device']);
 rejects(fn()=>$service->deviceRequest('ack',['jobId'=>$job['id'],'lease'=>$job['lease'],'action'=>'sent'],['HTTP_X_DYWS_PRINTER_TOKEN'=>$secondToken]),404);
 $service->manage(['printerId'=>$printer,'action'=>'revoke']);rejects(fn()=>$poll(),401);rejects(fn()=>$service->enroll($enroll),401);
 echo "Order printer backend: $checks checks passed.\n";
}finally{foreach(glob($dir.'/*')as $file)unlink($file);rmdir($dir);}
