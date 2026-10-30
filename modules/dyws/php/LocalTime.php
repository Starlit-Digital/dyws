<?php
declare(strict_types=1);
namespace dyws;
/** Converts an unambiguous local civil time to an instant. */
final class LocalTime {
 public static function instant(array $schedule,string $zone):\DateTimeImmutable {
  $text=$schedule['date'].' '.$schedule['time'];$tz=new \DateTimeZone($zone);
  $at=\DateTimeImmutable::createFromFormat('!Y-m-d H:i',$text,$tz);
  if(!$at||$at->format('Y-m-d H:i')!==$text)throw new ApiError('This pickup time does not exist. Choose another date or time.');
  // Repeated clock times would need an offset selector. Reject them explicitly.
  $utc=$at->getTimestamp();$offsets=array_unique(array_column($tz->getTransitions($utc-86400,$utc+86400)?:[],'offset'));
  foreach($offsets as $offset){$other=$utc+$at->getOffset()-$offset;if($other!==$utc&&(new \DateTimeImmutable('@'.$other))->setTimezone($tz)->format('Y-m-d H:i')===$text)throw new ApiError('This pickup time occurs twice when the clocks change. Choose another time.');}
  return $at;
 }
}
