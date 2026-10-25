<?php
declare(strict_types=1);
namespace dyws\Payments;
use dyws\{PluginContext,ApiError};
function registerConnector(PluginContext $plugin,Connector $connector):void {
 $id=$plugin->id;$base='/manager/plugins/'.$id;
 $plugin->addFilter('payments.connector',static fn(array $current,string $requested)=>$requested===$id?['connector'=>$connector]:$current);
 $plugin->addFilter('api.response',static function(array $result,string $route)use($connector,$id):array{if($route==='/manager/plugins')foreach($result['plugins'] as &$record)if($record['id']===$id){$s=$connector->summary();$record['connection']=['configured'=>$s['configured'],'verifiedAt'=>$s['verifiedAt'],'checkoutEnabled'=>false];}return $result;});
 $plugin->route('GET',$base.'/settings','manager',fn()=>$connector->summary());
 $plugin->route('POST',$base.'/settings','manager',fn($body)=>$connector->save($body),['rateLimit'=>['payment-settings',30,900]]);
 $plugin->route('POST',$base.'/verify','manager',static function()use($connector,$plugin,$id){$result=$connector->verify();$plugin->store?->plugins?->doAction('payments.connector_verified',$id,$result);return $result;},['rateLimit'=>['payment-verify',10,900]]);
 $route=$connector->definition()['webhook'];
 if($route)$plugin->route('POST',$route,'public',static function($body,$session,$request)use($connector,$plugin,$id){
  $event=$connector->verifyEvent($request['raw'],$request['server']);
  if(!$plugin->store)throw new ApiError('Payment event storage is unavailable.',503);
  $key=$id.':'.hash('sha256',$request['raw']);$store=$plugin->store;
  $fresh=$store->transaction(function()use($store,$key){if($store->query('SELECT 1 FROM payment_events WHERE tenant=? AND event_id=?',[$store->tenant,$key]))return false;$store->execute('INSERT INTO payment_events(tenant,event_id,created_at) VALUES(?,?,?)',[$store->tenant,$key,time()]);return true;});
  if($fresh)$store->plugins?->doAction('payments.connector_event',$id,$event);
  // Verified observation is deliberately separate from authoritative order payment reconciliation.
  return ['received'=>true];
 },['maxBody'=>262144]);
}
