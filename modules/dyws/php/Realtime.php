<?php
declare(strict_types=1);
namespace dyws;
final class Realtime {
 private array $emitted=[];
 public function __construct(private array $config,private Store $store){}
 public function publicConfig():array {
  $url=$this->config['realtime']['url']??null;
  return ['url'=>$url?:null,'fallback'=>'polling'];
 }
 public function trustedRelay():bool {
  $secret=$this->config['realtime']['secret']??'';
  return strlen($secret)>=32&&hash_equals($secret,$_SERVER['HTTP_X_DYWS_RELAY_KEY']??'');
 }
 public function access(string $scope,?array $session=null,?string $order=null):array {
  $channels=[$this->store->tenant.':public'];
  if($scope==='operator')$channels[]=$this->store->tenant.':operators';
  if($scope==='tracking')$channels[]=$this->store->tenant.':order:'.$order;
  $versions=[];foreach($channels as $channel)$versions[$channel]=$this->store->query('SELECT revision FROM realtime_versions WHERE channel=?',[$channel])[0]['revision']??'';
  return ['channels'=>$channels,'revision'=>hash('sha256',json_encode($versions)), 'expiresAt'=>min(time()+60,$session['expires_at']??PHP_INT_MAX)];
 }
 public function changed(array $channels):void {
  $channels=array_values(array_unique($channels));if(!$channels)return;
  foreach($channels as $channel)$this->store->execute('INSERT INTO realtime_versions(channel,revision) VALUES(?,?) ON CONFLICT(channel) DO UPDATE SET revision=excluded.revision',[$channel,bin2hex(random_bytes(12))]);
  // Relay RPC responses carry invalidation topics internally, never credentials or GPS.
  if($this->trustedRelay()){$this->emitted=array_values(array_unique(array_merge($this->emitted,$channels)));header('X-DYWS-Events: '.json_encode($this->emitted));return;}
  $url=$this->config['realtime']['publishUrl']??'';$secret=$this->config['realtime']['secret']??'';
  if(!$url||strlen($secret)<32||!function_exists('curl_init'))return;
  $ch=curl_init($url);curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode(['channels'=>$channels]),CURLOPT_HTTPHEADER=>['Content-Type: application/json','X-DYWS-Relay-Key: '.$secret],CURLOPT_CONNECTTIMEOUT_MS=>250,CURLOPT_TIMEOUT_MS=>600,CURLOPT_RETURNTRANSFER=>true]);curl_exec($ch);curl_close($ch);
 }
 public function mutation(string $route,array $result):void {
  if(in_array($route,['/realtime/access','/login'],true))return;
  $prefix=$this->store->tenant.':';$channels=[$prefix.'operators'];
  if(in_array($route,['/manager/catalog','/manager/deals','/manager/settings','/manager/plugins','/manager/drivers'],true)||str_starts_with($route,'/manager/plugins/'))$channels[]=$prefix.'public';
  if(preg_match('~/([A-Z]{2,7}-[A-F0-9]{12})(?:/|$)~',$route,$m))$channels[]=$prefix.'order:'.$m[1];
  elseif(isset($result['id'])&&preg_match('/^[A-Z]{2,7}-[A-F0-9]{12}$/',$result['id']))$channels[]=$prefix.'order:'.$result['id'];
  if(str_contains($route,'/runs/'))foreach($result['orderIds']??[] as $id)$channels[]=$prefix.'order:'.$id;
  if($route==='/manager/runs')foreach($result['orderIds']??[] as $id)$channels[]=$prefix.'order:'.$id;
  if(preg_match('~/orders/(DYWS-[A-F0-9]{12})/status$~',$route,$order)){
   $stops=$this->store->query('SELECT DISTINCT other.order_id FROM delivery_run_stops member JOIN delivery_run_stops other ON other.tenant=member.tenant AND other.run_id=member.run_id WHERE member.tenant=? AND member.order_id=?',[$this->store->tenant,$order[1]]);
   foreach($stops as $stop)$channels[]=$prefix.'order:'.$stop['order_id'];
  }
  $this->changed($channels);
 }
}
