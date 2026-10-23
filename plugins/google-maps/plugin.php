<?php
declare(strict_types=1);
use StarlitGo\PluginContext;
use StarlitGo\Plugins\GoogleMaps\MapsSettings;
require_once __DIR__.'/MapsSettings.php';
return static function(PluginContext $plugin):void {
 $settings=new MapsSettings($plugin->config);
 foreach(['/maps/config','/plugins/google-maps/config'] as $path)$plugin->route('GET',$path,'public',fn()=>$settings->publicConfig());
 foreach(['/manager/maps','/manager/plugins/google-maps/settings'] as $path){
  $plugin->route('GET',$path,'manager',fn()=>$settings->summary());
  $plugin->route('POST',$path,'manager',fn(array $body)=>$settings->save($body));
 }
};
