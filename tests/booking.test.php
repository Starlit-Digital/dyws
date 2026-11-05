<?php
declare(strict_types=1);
require __DIR__.'/../server/bootstrap.php';
require __DIR__.'/../plugins/booking/Booking.php';
use dyws\{Store,Catalog,ApiError};
use dyws\Plugins\Booking\Booking;
$dir=sys_get_temp_dir().'/dyws-booking-'.bin2hex(random_bytes(6));mkdir($dir,0700);$checks=0;
function check(bool $v):void{global $checks;if(!$v)throw new RuntimeException('Failed check '.($checks+1));$checks++;}
function rejects(callable $f,int $http):void{try{$f();throw new RuntimeException('Expected rejection');}catch(ApiError $e){check($e->http===$http);}}
try{
 $config=['tracking_secret'=>str_repeat('s',64),'booking'=>['services'=>[['id'=>'haircut','name'=>'Haircut','duration'=>45],['id'=>'beard','name'=>'Beard trim','duration'=>15]],'days'=>[1,2,3,4,5,6,7]]];$GLOBALS['dyws_config']=$config;
 $catalog=Catalog::load(__DIR__.'/../examples/starlit-diner/catalog.json');$store=new Store($dir.'/test.sqlite',$catalog,'booking-a');$a=new Booking($config,$store);
 $date=(new DateTimeImmutable('tomorrow',new DateTimeZone('America/Edmonton')))->format('Y-m-d');
 $slots=$a->availability(['serviceId'=>'haircut','date'=>$date]);check(count($slots['slots'])>0);
 check(array_column($slots['slots'],'label')===['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00']);
 $start=$slots['slots'][0]['startsAt'];$body=['serviceId'=>'haircut','startsAt'=>$start,'customer'=>['name'=>'Fictional Guest','phone'=>'7805550142'],'acknowledged'=>true,'idempotencyKey'=>bin2hex(random_bytes(16))];
 $receipt=$a->reserve($body);check($receipt['status']==='confirmed');check($receipt===$a->reserve($body));
 rejects(fn()=>$a->reserve(array_replace($body,['startsAt'=>$start+900])),409);
 rejects(fn()=>$a->reserve(array_replace($body,['idempotencyKey'=>bin2hex(random_bytes(16))])),409);
 $after=$a->availability(['serviceId'=>'haircut','date'=>$date]);check(!in_array($start+900,array_column($after['slots'],'startsAt'),true));
 rejects(fn()=>$a->reserve(array_replace($body,['serviceId'=>'beard','idempotencyKey'=>bin2hex(random_bytes(16))])),409);
 $other=new Booking($config,new Store($dir.'/test.sqlite',$catalog,'booking-b'));check(count($other->availability(['serviceId'=>'haircut','date'=>$date])['slots'])===count($slots['slots']));
 rejects(fn()=>$other->change(['id'=>$receipt['id'],'token'=>$receipt['cancellationToken']]),404);
 rejects(fn()=>$a->change(['id'=>$receipt['id'],'token'=>'wrong']),404);
 check($a->change(['id'=>$receipt['id'],'token'=>$receipt['cancellationToken']])['status']==='cancelled');
 check(count($a->availability(['serviceId'=>'haircut','date'=>$date])['slots'])===count($slots['slots']));
 check($a->reserve($body)['status']==='cancelled');
 $next=$a->reserve(array_replace($body,['idempotencyKey'=>bin2hex(random_bytes(16))]));rejects(fn()=>$a->change(['id'=>$next['id'],'status'=>'completed'],true),409);$store->execute('UPDATE appointments SET starts_at=?,ends_at=? WHERE tenant=? AND id=?',[time()-3600,time()-1800,$store->tenant,$next['id']]);check($a->change(['id'=>$next['id'],'status'=>'completed'],true)['status']==='completed');
 rejects(fn()=>$a->availability(['serviceId'=>'haircut','date'=>'2026-02-31']),422);
 $demo=new Booking(array_replace($config,['demo_lockdown'=>true]),new Store($dir.'/test.sqlite',$catalog,'demo'));
 $demo->reserve(array_replace($body,['customer'=>['name'=>'Never retained','phone'=>'7805551234']]));check(!str_contains(json_encode($demo->listing()),'Never retained'));
 $configuration=$a->configuration();$changed=$a->configure(['revision'=>$configuration['revision'],'settings'=>array_replace($configuration,['openMinute'=>615,'closeMinute'=>720,'slotIncrementMinutes'=>30])]);check($changed['openMinute']===615);
 check(array_column($a->availability(['serviceId'=>'haircut','date'=>$date])['slots'],'label')===['10:30','11:00']);
 rejects(fn()=>$a->configure(['revision'=>$changed['revision'],'settings'=>array_replace($changed,['slotIncrementMinutes'=>17])]),422);
 rejects(fn()=>$a->configure(['revision'=>$configuration['revision'],'settings'=>$configuration]),409);
 rejects(fn()=>$a->configure(['revision'=>$changed['revision'],'settings'=>array_replace($configuration,['services'=>[['id'=>'bad','name'=>'Bad','duration'=>0]]])]),422);
 check($a->configuration()['openMinute']===615);
 $store->execute('UPDATE appointments SET created_at=? WHERE tenant=?',[time()-90000,'demo']);new Booking(array_replace($config,['demo_lockdown'=>true]),new Store($dir.'/test.sqlite',$catalog,'demo'));check($store->query('SELECT id FROM appointments WHERE tenant=?',['demo'])===[]);
 echo "Booking: $checks checks passed\n";
}finally{foreach(glob($dir.'/*') as $f)unlink($f);rmdir($dir);}
