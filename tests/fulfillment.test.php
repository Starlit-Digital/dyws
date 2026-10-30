<?php
declare(strict_types=1);
require __DIR__.'/../server/Store.php';
use dyws\{Store,ApiError};
use dyws\Plugins\Pickup\Pickup as Fulfillment;
require_once __DIR__.'/../plugins/pickup/Pickup.php';
$checks=0;
function check($ok,$message){global $checks;if(!$ok)throw new RuntimeException($message);$checks++;}
function rejects($fn,$code=422){try{$fn();throw new RuntimeException('Expected rejection');}catch(ApiError $e){check($e->http===$code,$e->getMessage());}}
$zone='America/New_York';$at=fn($s)=>(new DateTimeImmutable($s,new DateTimeZone($zone)))->getTimestamp();
$schedule=['date'=>'2030-01-07','time'=>'12:30'];$now=$at('2030-01-07 12:00');
$meta=Fulfillment::create('pickup',$schedule,$zone,'north',[],$now);
check($meta['type']==='scheduled_pickup'&&$meta['scheduledAt']===$now+1800&&$meta['scheduledAtUtc']==='2030-01-07T17:30:00Z','Thirty minute boundary and UTC metadata');
rejects(fn()=>Fulfillment::create('pickup',$schedule,$zone,'north',[],$now+1));
foreach([['date'=>'2030-02-30','time'=>'12:00'],['date'=>'2027-03-14','time'=>'02:15'],['date'=>'2026-11-01','time'=>'01:15']] as $bad)rejects(fn()=>\dyws\LocalTime::instant($bad,$zone));
foreach([[],true,['date'=>'2030-01-07','time'=>'12:50'],['date'=>'2030-01-07','time'=>'24:00'],['date'=>'2030-01-07','time'=>'12:15','zone'=>'UTC']] as $bad)rejects(fn()=>Fulfillment::schedule($bad,'pickup'));
rejects(fn()=>Fulfillment::schedule($schedule,'delivery'));
$hours=['enabled'=>true,'days'=>array_fill(0,7,['mode'=>'hours','open'=>'09:00','close'=>'12:30'])];
rejects(fn()=>Fulfillment::create('pickup',$schedule,$zone,'north',['locationHours'=>$hours],$now));
$hours['days'][0]=['mode'=>'hours','open'=>'22:00','close'=>'02:00'];
check(Fulfillment::create('pickup',['date'=>'2030-01-08','time'=>'01:45'],$zone,'north',['locationHours'=>$hours],$now)['scheduled'],'Overnight opening belongs to previous day');
$available=Fulfillment::availability('2030-01-07',$zone,'north',[],$now);
check($available['slots'][0]['time']==='12:30','Availability includes exact lead boundary');
check(Fulfillment::availability('2030-01-07',$zone,'north',[],$now+1)['slots'][0]['time']==='12:45','One second later advances to next quarter');
$future=Fulfillment::availability(null,$zone,'north',['locationHours'=>$hours],$at('2030-01-07 23:40'));
check($future['date']==='2030-01-08'&&$future['slots'][0]['time']==='00:15','Earliest availability crosses midnight during overnight hours');
$closed=['enabled'=>true,'days'=>array_fill(0,7,['mode'=>'closed'])];
check(Fulfillment::availability(null,$zone,'north',['locationHours'=>$closed],$now)['slots']===[],'Fully closed week has no slots');
foreach([['2027-03-14','02:'],['2026-11-01','01:']] as [$date,$hour]){
 $slots=Fulfillment::availability($date,$zone,'north',[],$at($date.' 00:00'))['slots'];
 check(!array_filter($slots,fn($slot)=>str_starts_with($slot['time'],$hour)),'Nonexistent or repeated DST times are omitted');
}
rejects(fn()=>Fulfillment::availability('2030-02-30',$zone,'north',[],$now));
$path=tempnam(sys_get_temp_dir(),'dyws-pickup-');$GLOBALS['dyws_config']=['tracking_secret'=>str_repeat('s',64)];
$catalog=json_decode(file_get_contents(__DIR__.'/../examples/starlit-diner/catalog.json'),true);$catalog['locationHours']=null;$catalog['orderingHours']=null;$catalog['locations']=[];
$body=['idempotencyKey'=>bin2hex(random_bytes(16)),'fulfillment'=>'pickup','customer'=>['name'=>'Fictional Pickup Guest','phone'=>'7805550100'],'lines'=>[['id'=>'breakfast0','quantity'=>1]],'pickupSchedule'=>['date'=>(new DateTimeImmutable('tomorrow',new DateTimeZone($zone)))->format('Y-m-d'),'time'=>'12:00'],'fulfillmentMeta'=>['type'=>'delivery','timeZone'=>'UTC']];
try{
 $store=new Store($path,$catalog,'dyws-diner',$zone);$receipt=$store->create($body);$id=$receipt['id'];$meta=$receipt['fulfillmentMeta'];
 check($meta['type']==='scheduled_pickup'&&$meta['timeZone']===$zone,'Server generates metadata and ignores caller claims');
 check($store->tracking($id,$receipt['trackingToken'])['fulfillmentMeta']===$meta,'Customer tracking exposes exact saved metadata');
 check($store->safeOrder($store->get($id))['fulfillmentMeta']===$meta,'Operator order exposes exact saved metadata');
 check($store->get($id)['tracking_expires']===$meta['scheduledAt']+86400,'Future pickup tracking lasts through pickup day');
 $changed=new Store($path,$catalog,'dyws-diner','America/Toronto',false);
 check($changed->create($body)===$receipt,'Retry retains original zone and metadata after settings change');
 $bad=$body;$bad['pickupSchedule']['time']='12:15';rejects(fn()=>$store->create($bad),409);
 $body['idempotencyKey']=bin2hex(random_bytes(16));unset($body['pickupSchedule']);$plain=$store->create($body);
 check($plain['fulfillmentMeta']['type']==='pickup'&&!$plain['fulfillmentMeta']['scheduled'],'Ordinary pickup remains distinct');
 $body['idempotencyKey']=bin2hex(random_bytes(16));$body['fulfillment']='delivery';$body['address']='100 Example Road';$delivery=$store->create($body);
 check($delivery['fulfillmentMeta']['type']==='delivery','Delivery metadata remains distinct');
 $other=new Store($path,$catalog,'other');rejects(fn()=>$other->get($id),404);
 $store->db->exec('ALTER TABLE orders DROP COLUMN fulfillment_meta_json');unset($store,$changed,$other);
 $store=new Store($path,$catalog);$legacy=$store->safeOrder($store->get($plain['id']))['fulfillmentMeta'];
 check($legacy['type']==='pickup'&&$legacy['timeZone']===null,'Legacy migration does not invent dates or zones');
 echo "Fulfillment: $checks checks passed.\n";
}finally{unset($store);foreach([$path,$path.'-wal',$path.'-shm'] as $file)if(is_file($file))unlink($file);}
