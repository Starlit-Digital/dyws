<?php
declare(strict_types=1);
use dyws\{ApiError,Store,PluginContext,AdminAccounts};
use dyws\Plugins\Delivery\Runs;
require_once __DIR__.'/Runs.php';
return static function(PluginContext $plugin):void {
 $runs=$plugin->store?new Runs($plugin->store):null;
 $plugin->provideOperation('schedule.normalize',static function($value){if($value!==null)throw new ApiError('Scheduled times are available for pickup orders only.');return null;});
 $plugin->provideOperation('fulfillment.create',static fn($schedule,$zone,$location,$policy)=>['version'=>1,'type'=>'delivery','label'=>'Delivery','scheduled'=>false,'scheduledAt'=>null,'scheduledAtUtc'=>null,'localDate'=>null,'localTime'=>null,'timeZone'=>$zone,'locationId'=>$location]);
 $plugin->provideOperation('run.create',fn($driver,$ids,$key)=>$runs->create($driver,$ids,$key));
 $plugin->addFilter('catalog.public',static function(array $catalog):array{$catalog['fulfillmentModes'][]='delivery';return $catalog;});
 $plugin->route('POST','/manager/runs','manager',fn(array $body)=>(new AdminAccounts($plugin->config))->createRun($plugin->store,$body));
 $plugin->route('POST','/manager/runs/{runId}','manager',fn(array $body,$session,$request)=>$runs->edit($request['params']['runId'],$body));
 $plugin->route('POST','/driver/runs/{runId}/start','driver',fn(array $body,$session,$request)=>$runs->start($request['params']['runId'],$session['subject']));
 foreach(['update','start','stop','heartbeat'] as $action){
  $path='/driver/runs/{runId}/location'.($action==='update'?'':'/'.$action);
  $plugin->route('POST',$path,'driver',static function(array $body,$session,$request)use($plugin,$runs,$action):array{
   if(isset($plugin->config['driver_test_location'])){$body['source']='simulated';$body=array_replace($body,array_intersect_key($plugin->config['driver_test_location'],array_flip(['latitude','longitude','accuracy'])));}
   return $runs->location($request['params']['runId'],$session,$action,$body);
  },['rateLimit'=>['gps-run',120,60]]);
 }
};
