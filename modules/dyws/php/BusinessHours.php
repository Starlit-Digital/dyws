<?php
declare(strict_types=1);
namespace dyws;

/** Weekly civil time schedules, Monday first. End times are exclusive. */
final class BusinessHours {
 public static function validate($schedule):?array {
  if($schedule===null)return null;
  if(!is_array($schedule)||!is_bool($schedule['enabled']??null)||!is_array($schedule['days']??null)||!array_is_list($schedule['days'])||count($schedule['days'])!==7)throw new ApiError('Provide all seven days for business hours.');
  $days=[];
  foreach($schedule['days'] as $day){
   if(!is_array($day)||!in_array($day['mode']??null,['closed','hours','allDay'],true))throw new ApiError('Choose closed, set hours or 24 hours for each day.');
   $open=$day['open']??'09:00';$close=$day['close']??'17:00';
   foreach([$open,$close] as $time)if(!is_string($time)||!preg_match('/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/D',$time))throw new ApiError('Use valid opening and closing times.');
   if($day['mode']==='hours'&&$open===$close)throw new ApiError('Opening and closing times must differ. Choose 24 hours for an all day schedule.');
   $days[]=['mode'=>$day['mode'],'open'=>$open,'close'=>$close];
  }
  return ['enabled'=>$schedule['enabled'],'days'=>$days];
 }
 public static function isOpen(?array $schedule,\DateTimeImmutable $at):bool {
  if(!$schedule||!$schedule['enabled'])return true;
  $index=(int)$at->format('N')-1;$time=$at->format('H:i');$day=$schedule['days'][$index];$previous=$schedule['days'][($index+6)%7];
  // An overnight period belongs to the day on which it opens.
  if($previous['mode']==='hours'&&$previous['close']<$previous['open']&&$time<$previous['close'])return true;
  if($day['mode']==='allDay')return true;
  if($day['mode']==='closed')return false;
  return $day['close']<$day['open']?$time>=$day['open']:($time>=$day['open']&&$time<$day['close']);
 }
}
