<?php
declare(strict_types=1);
require __DIR__.'/../server/bootstrap.php';
use dyws\{BusinessHours,Catalog,Store,ApiError};
$dir=sys_get_temp_dir().'/dyws-policy-'.bin2hex(random_bytes(6));mkdir($dir,0700);$checks=0;
$GLOBALS['dyws_config']=['tracking_secret'=>str_repeat('x',64)];
function check($ok){global $checks;if(!$ok)throw new RuntimeException('Check '.($checks+1).' failed');$checks++;}
function denied(callable $fn,int $code=422){try{$fn();throw new RuntimeException('Expected rejection');}catch(ApiError $e){check($e->http===$code);}}
try{
 $closed=['enabled'=>true,'days'=>array_fill(0,7,['mode'=>'closed','open'=>'09:00','close'=>'17:00'])];
 $hours=$closed;$hours['days'][6]=['mode'=>'hours','open'=>'22:00','close'=>'02:00'];
 foreach([['2026-10-26 01:59',true],['2026-10-26 02:00',false],['2026-10-25 21:59',false],['2026-10-25 22:00',true]] as [$at,$open])check(BusinessHours::isOpen($hours,new DateTimeImmutable($at,new DateTimeZone('America/Edmonton')))===$open);
 foreach([[],['enabled'=>'true','days'=>$closed['days']],['enabled'=>true,'days'=>[]]] as $bad)denied(fn()=>BusinessHours::validate($bad));
 foreach(['24:00','9:00','12:90',null] as $time){$bad=$hours;$bad['days'][0]['open']=$time;if($time!==null)denied(fn()=>BusinessHours::validate($bad));}
 $bad=$hours;$bad['days'][0]=['mode'=>'hours','open'=>'09:00','close'=>'09:00'];denied(fn()=>BusinessHours::validate($bad));
 $catalog=Catalog::load(__DIR__.'/../examples/starlit-diner/catalog.json');$catalog['deliveryFee']=395;$catalog['deliveryFeeBasisPoints']=250;
 check(Catalog::deliveryCharge($catalog,1495,'delivery')===432);check(Catalog::deliveryCharge($catalog,1495,'pickup')===0);
 foreach([-1,10001,1.5,'250',false] as $bps){$bad=$catalog;$bad['deliveryFeeBasisPoints']=$bps;denied(fn()=>Catalog::validate($bad));}
 $body=['idempotencyKey'=>'policy-fixture-key-123','customer'=>['name'=>'Fictional Guest','phone'=>'7805550100'],'fulfillment'=>'delivery','address'=>'123 Example Road','lines'=>[['id'=>'breakfast0','variant'=>'','quantity'=>1]],'total'=>1,'deliveryFee'=>0];
 $catalog['locationHours']=$closed; // Location hours never stop online ordering.
 $store=new Store($dir.'/orders.sqlite',$catalog,'policy');$receipt=$store->create($body);$order=$store->get($receipt['id']);check((int)$order['delivery_fee']===432);check((int)$order['total']===2023);
 $catalog['orderingHours']=$closed;$closedStore=new Store($dir.'/orders.sqlite',$catalog,'policy');check($closedStore->create($body)['id']===$receipt['id']);$next=$body;$next['idempotencyKey']='policy-new-order-key-123';denied(fn()=>$closedStore->create($next),409);
 $catalog['locations']=[['id'=>'branch','name'=>'Branch','address'=>'456 Example Road','active'=>true,'orderingHours'=>['enabled'=>false,'days'=>$closed['days']],'deliveryPricing'=>['flatFee'=>200,'basisPoints'=>1000]]];$catalog=Catalog::validate($catalog);$branch=new Store($dir.'/orders.sqlite',$catalog,'branch');$r=$branch->create($next+['locationId'=>'branch']);check((int)$branch->get($r['id'])['delivery_fee']===350);
 $paused=new Store($dir.'/orders.sqlite',$catalog,'branch','America/Edmonton',false);check($paused->create($next+['locationId'=>'branch'])['id']===$r['id']);$next['idempotencyKey']='policy-paused-order-key';denied(fn()=>$paused->create($next+['locationId'=>'branch']),409);
 echo "Business policies: $checks checks passed.\n";
}finally{foreach(glob($dir.'/*') as $file)unlink($file);rmdir($dir);}
