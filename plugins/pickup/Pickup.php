<?php
declare(strict_types=1);
namespace dyws\Plugins\Pickup;
use dyws\{ApiError,BusinessHours,Catalog,Store,LocalTime};
final class Pickup {
 public const LEAD_SECONDS=1800;
 public static function availability(?string $date,string $zone,string $locationId,array $policy,?int $now=null):array {
  $now??=time();$today=(new \DateTimeImmutable('@'.$now))->setTimezone(new \DateTimeZone($zone))->setTime(0,0);
  if($date!==null){
   if(!preg_match('/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/D',$date))throw new ApiError('Choose a date.');
   $day=\DateTimeImmutable::createFromFormat('!Y-m-d',$date,new \DateTimeZone($zone));
   if(!$day||$day->format('Y-m-d')!==$date)throw new ApiError('Choose a valid date.');
  }else $day=$today;
  $slots=[];
  // Eight dates include the remaining part of today and a full weekly hours cycle.
  for($days=0;$days<($date===null?8:1);$days++,$day=$day->modify('+1 day')){
   for($minute=0;$minute<1440;$minute+=15){
    $time=sprintf('%02d:%02d',intdiv($minute,60),$minute%60);
    try{$meta=self::create('pickup',['date'=>$day->format('Y-m-d'),'time'=>$time],$zone,$locationId,$policy,$now);$slots[]=['time'=>$time,'scheduledAt'=>$meta['scheduledAt']];}catch(ApiError $e){continue;}
   }
   if($slots)break;
  }
  return ['timeZone'=>$zone,'serverTime'=>$now,'minDate'=>$today->format('Y-m-d'),'date'=>$date??($slots?$day->format('Y-m-d'):$today->format('Y-m-d')),'slots'=>$slots];
 }
 public static function schedule($value,string $type):?array {
  if($value===null)return null;
  if($type!=='pickup')throw new ApiError('Scheduled times are available for pickup orders only.');
  if(!is_array($value)||array_diff(array_keys($value),['date','time'])||!is_string($value['date']??null)||!is_string($value['time']??null)
   ||!preg_match('/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/D',$value['date'])||!preg_match('/^(?:[01][0-9]|2[0-3]):(?:00|15|30|45)$/D',$value['time']))throw new ApiError('Choose a pickup date, hour and quarter hour.');
  return ['date'=>$value['date'],'time'=>$value['time']];
 }
 public static function create(string $type,?array $schedule,string $zone,string $locationId,array $policy,?int $now=null):array {
  $at=$schedule?LocalTime::instant($schedule,$zone):null;
  if($at){
   if($at->getTimestamp()<($now??time())+self::LEAD_SECONDS)throw new ApiError('Schedule pickup at least 30 minutes ahead.');
   if(!BusinessHours::isOpen($policy['locationHours']??null,$at))throw new ApiError('Choose a pickup time during this location’s open hours.');
  }
  return ['version'=>1,'type'=>$at?'scheduled_pickup':$type,'label'=>$at?'Scheduled pickup':($type==='delivery'?'Delivery':'Pickup'),'scheduled'=>$at!==null,'scheduledAt'=>$at?->getTimestamp(),'scheduledAtUtc'=>$at?->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d\TH:i:s\Z'),'localDate'=>$at?->format('Y-m-d'),'localTime'=>$at?->format('H:i'),'timeZone'=>$zone,'locationId'=>$locationId];
 }
 public static function preview(Store $store,array $body):array {
  $context=$store->businessContext();$catalog=$context['catalog'];$locations=array_values(array_filter($catalog['locations']??[],fn($l)=>$l['active']));
  $id=Store::text($body['locationId']??(count($locations)===1?$locations[0]['id']:''),80,false);$location=Catalog::orderLocation($catalog,$id);
  $schedule=self::schedule($body['pickupSchedule']??null,'pickup');if(!$schedule)throw new ApiError('Choose a pickup date and time.');
  return self::create('pickup',$schedule,$context['timeZone'],$id,Catalog::locationPolicy($catalog,$id));
 }
 public static function slots(Store $store,array $body):array {
  $context=$store->businessContext();$catalog=$context['catalog'];$locations=array_values(array_filter($catalog['locations']??[],fn($l)=>$l['active']));
  $id=Store::text($body['locationId']??(count($locations)===1?$locations[0]['id']:''),80,false);$location=Catalog::orderLocation($catalog,$id);
  return self::availability(array_key_exists('date',$body)?Store::text($body['date'],10):null,$context['timeZone'],$id,Catalog::locationPolicy($catalog,$id));
 }
}
