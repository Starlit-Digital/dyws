<?php
declare(strict_types=1);
use dyws\PluginContext;
use dyws\Plugins\OpenStreetMap\{Settings,OrderMap};
require_once __DIR__.'/Settings.php';require_once __DIR__.'/OrderMap.php';require_once __DIR__.'/MapPDF.php';
return #[\dyws\Provides('admin:navigation','admin:settings')] static function(PluginContext $plugin):void {
 if(!$plugin->store)return;$settings=new Settings($plugin->config);$map=static fn()=>new OrderMap($plugin->store,$plugin->config);
 $plugin->route('GET','/manager/plugins/openstreetmap/settings','manager',fn()=>$settings->summary());
 $plugin->route('POST','/manager/plugins/openstreetmap/settings','manager',fn(array $body)=>$settings->save($body));
 $plugin->route('POST','/manager/plugins/openstreetmap/captures','manager',fn(array $body)=>(new \dyws\Plugins\OpenStreetMap\MapPDF($plugin->store,$plugin->config))->capture($body),['maxBody'=>262144,'rateLimit'=>['osm-pdf-capture',120,3600]]);
 $plugin->route('POST','/manager/plugins/openstreetmap/export','manager',fn(array $body)=>(new \dyws\Plugins\OpenStreetMap\MapPDF($plugin->store,$plugin->config))->export($body),['maxBody'=>262144,'rateLimit'=>['osm-pdf-export',30,3600]]);
 $plugin->route('GET','/manager/plugins/openstreetmap/dataset','manager',fn()=>$map()->dataset($_GET));
 $plugin->route('POST','/manager/plugins/openstreetmap/geocode','manager',static function(array $body)use($map):array{$query=$body['query']??[];if(!is_array($query))throw new \dyws\ApiError('Provide map filters.');return $map()->geocodeNext($query);},['maxBody'=>2048,'rateLimit'=>['osm-geocode',60,60]]);
};
