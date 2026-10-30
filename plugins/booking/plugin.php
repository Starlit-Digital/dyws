<?php
declare(strict_types=1);
use dyws\PluginContext;
require_once __DIR__.'/Booking.php';
return #[\dyws\Provides('admin:settings','admin:navigation')] static function(PluginContext $plugin):void {
 if(!$plugin->store)return;
 $booking=new \dyws\Plugins\Booking\Booking($plugin->config,$plugin->store);
 $plugin->route('GET','/manager/plugins/booking/settings','manager',fn()=>$booking->configuration());
 $plugin->route('POST','/manager/plugins/booking/settings','manager',fn(array $b)=>$booking->configure($b));
 $plugin->route('GET','/plugins/booking/services','public',fn()=>$booking->settings());
 $plugin->route('POST','/plugins/booking/availability','public',fn(array $b)=>$booking->availability($b),['rateLimit'=>['booking-availability',120,60]]);
 $plugin->route('POST','/plugins/booking/reserve','public',fn(array $b)=>$booking->reserve($b),['rateLimit'=>['booking-reserve',20,3600]]);
 $plugin->route('POST','/plugins/booking/cancel','public',fn(array $b)=>$booking->change($b),['rateLimit'=>['booking-cancel',30,900]]);
 $plugin->route('GET','/manager/plugins/booking/appointments','manager',fn()=>$booking->listing());
 $plugin->route('POST','/manager/plugins/booking/appointments','manager',fn(array $b)=>$booking->change($b,true));
};
