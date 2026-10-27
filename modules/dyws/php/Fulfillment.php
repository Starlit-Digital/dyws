<?php
declare(strict_types=1);
namespace dyws;

/** Immutable fulfillment facts for tickets and future order integrations. */
final class Fulfillment {
 public const LEAD_SECONDS=1800;
 public static function schedule($value,string $type):?array {
  if($value===null)return null;
  if($type!=='pickup')throw new ApiError('Scheduled times are available for pickup orders only.');
  if(!is_array($value)||array_diff(array_keys($value),['date','time'])||!is_string($value['date']??null)||!is_string($value['time']??null)
   ||!preg_match('/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/D',$value['date'])||!preg_match('/^(?:[01][0-9]|2[0-3]):(?:00|15|30|45)$/D',$value['time']))throw new ApiError('Choose a pickup date, hour and quarter hour.');
  return ['date'=>$value['date'],'time'=>$value['time']];
 }
 public static function instant(array $schedule,string $zone):\DateTimeImmutable {
  $text=$schedule['date'].' '.$schedule['time'];$tz=new \DateTimeZone($zone);
  $at=\DateTimeImmutable::createFromFormat('!Y-m-d H:i',$text,$tz);
  if(!$at||$at->format('Y-m-d H:i')!==$text)throw new ApiError('This pickup time does not exist. Choose another date or time.');
  // Repeated clock times would need an offset selector. Reject them explicitly.
  $utc=$at->getTimestamp();$offsets=array_unique(array_column($tz->getTransitions($utc-86400,$utc+86400)?:[],'offset'));
  foreach($offsets as $offset){$other=$utc+$at->getOffset()-$offset;if($other!==$utc&&(new \DateTimeImmutable('@'.$other))->setTimezone($tz)->format('Y-m-d H:i')===$text)throw new ApiError('This pickup time occurs twice when the clocks change. Choose another time.');}
  return $at;
 }
 public static function create(string $type,?array $schedule,string $zone,string $locationId,array $policy,?int $now=null):array {
  $at=$schedule?self::instant($schedule,$zone):null;
  if($at){
   if($at->getTimestamp()<($now??time())+self::LEAD_SECONDS)throw new ApiError('Schedule pickup at least 30 minutes ahead.');
   if(!BusinessHours::isOpen($policy['locationHours']??null,$at))throw new ApiError('Choose a pickup time during this location’s open hours.');
  }
  return ['version'=>1,'type'=>$at?'scheduled_pickup':$type,'label'=>$at?'Scheduled pickup':($type==='delivery'?'Delivery':'Pickup'),'scheduled'=>$at!==null,'scheduledAt'=>$at?->getTimestamp(),'scheduledAtUtc'=>$at?->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d\TH:i:s\Z'),'localDate'=>$at?->format('Y-m-d'),'localTime'=>$at?->format('H:i'),'timeZone'=>$zone,'locationId'=>$locationId];
 }
 public static function read(array $order):array {
  $saved=json_decode($order['fulfillment_meta_json']??'{}',true);
  if(($saved['version']??null)===1)return $saved;
  // Legacy orders have no historical zone snapshot. Do not invent one.
  $type=$order['fulfillment'];$location=json_decode($order['order_location_json']??'{}',true);
  return ['version'=>1,'type'=>$type,'label'=>$type==='delivery'?'Delivery':'Pickup','scheduled'=>false,'scheduledAt'=>null,'scheduledAtUtc'=>null,'localDate'=>null,'localTime'=>null,'timeZone'=>null,'locationId'=>$location['id']??''];
 }
}
