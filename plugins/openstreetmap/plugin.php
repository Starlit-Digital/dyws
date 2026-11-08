<?php
declare(strict_types=1);
use dyws\PluginContext;
use dyws\Plugins\OpenStreetMap\{Settings,OrderMap};
require_once __DIR__.'/Settings.php';require_once __DIR__.'/OrderMap.php';
return #[\dyws\Provides('admin:navigation','admin:settings')] static function(PluginContext $plugin):void {
 if(!$plugin->store)return;$settings=new Settings($plugin->config);$map=static fn()=>new OrderMap($plugin->store,$plugin->config);
 $plugin->route('GET','/manager/plugins/openstreetmap/settings','manager',fn()=>$settings->summary());
 $plugin->route('POST','/manager/plugins/openstreetmap/settings','manager',fn(array $body)=>$settings->save($body));
 $plugin->route('GET','/manager/plugins/openstreetmap/dataset','manager',fn()=>$map()->dataset($_GET));
 $plugin->route('POST','/manager/plugins/openstreetmap/geocode','manager',static function(array $body)use($map):array{$query=$body['query']??[];if(!is_array($query))throw new \dyws\ApiError('Provide map filters.');return $map()->geocodeNext($query);},['maxBody'=>2048,'rateLimit'=>['osm-geocode',60,60]]);
};
