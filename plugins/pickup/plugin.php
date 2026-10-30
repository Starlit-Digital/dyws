<?php
declare(strict_types=1);
use dyws\Plugins\Pickup\Pickup;
require_once __DIR__.'/Pickup.php';
return #[\dyws\Provides('checkout.pickup')] static function(\dyws\PluginContext $plugin):void {
 $plugin->provideOperation('schedule.normalize',fn($value)=>Pickup::schedule($value,'pickup'));
 $plugin->provideOperation('fulfillment.create',fn($schedule,$zone,$location,$policy)=>Pickup::create('pickup',$schedule,$zone,$location,$policy));
 $plugin->addFilter('catalog.public',static function(array $catalog):array{$catalog['fulfillmentModes'][]='pickup';return $catalog;});
 $plugin->route('POST','/pickup/preview','public',fn(array $body)=>Pickup::preview($plugin->store,$body),['rateLimit'=>['pickup-preview',60,60]]);
 $plugin->route('POST','/pickup/availability','public',fn(array $body)=>Pickup::slots($plugin->store,$body),['rateLimit'=>['pickup-availability',60,60]]);
};
