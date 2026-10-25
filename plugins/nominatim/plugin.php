<?php
declare(strict_types=1);
use dyws\PluginContext;
use dyws\Plugins\Nominatim\AddressLookup;
require_once __DIR__.'/AddressLookup.php';
return #[\dyws\Provides('checkout:fields','admin:settings')] static function(PluginContext $plugin):void {
 $lookup=new AddressLookup($plugin->config);
 $plugin->route('GET','/plugins/nominatim/config','public',fn()=>$lookup->publicConfig());
 $plugin->route('POST','/plugins/nominatim/search','public',fn(array $body)=>$lookup->search($body),['maxBody'=>1024,'rateLimit'=>['nominatim-search',40,60]]);
 $plugin->route('GET','/manager/plugins/nominatim/settings','manager',fn()=>$lookup->summary());
 $plugin->route('POST','/manager/plugins/nominatim/settings','manager',fn(array $body)=>$lookup->save($body));
};
