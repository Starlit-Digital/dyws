<?php
declare(strict_types=1);
namespace dyws\Plugins\Delivery;
use dyws\{Store,ApiError};
final class Runs extends \dyws\DeliveryRuns {
 public function create(string $driver,array $ids,string $requestKey):array {
  if(!preg_match('/^[a-zA-Z0-9-]{16,80}$/D',$requestKey))throw new ApiError('Invalid run request key.');
  if(count($ids)<1||count($ids)>20||array_values($ids)!==$ids)throw new ApiError('Choose between 1 and 20 delivery orders.');
  foreach($ids as $id)if(!is_string($id)||!preg_match('/^DYWS-[A-F0-9]{12}$/D',$id))throw new ApiError('Invalid delivery order.');
  if(count(array_unique($ids))!==count($ids))throw new ApiError('Choose each delivery once.');
  return $this->store->transaction(function()use($driver,$ids,$requestKey){
   $s=$this->store;$existing=$s->query('SELECT id,driver_id FROM delivery_runs WHERE tenant=? AND request_key=?',[$s->tenant,$requestKey])[0]??null;
   if($existing){$run=$this->get($existing['id']);if($run['driver_id']!==$driver||$run['orderIds']!==$ids)throw new ApiError('This run request has already been used.',409);return $run;}
   if($this->listing($driver)||$s->query("SELECT id FROM orders WHERE tenant=? AND driver_id=? AND status='out_for_delivery'",[$s->tenant,$driver]))throw new ApiError('Finish or cancel this driver’s current run before assigning another.',409);
   foreach($ids as $id){$o=$s->get($id);if($o['fulfillment']!=='delivery'||$o['status']!=='ready'||$this->membership($id)||($o['driver_id']&&$o['driver_id']!==$driver))throw new ApiError('Choose ready deliveries that are unassigned or assigned to this driver.',409);}
   $id='RUN-'.strtoupper(bin2hex(random_bytes(6)));$now=time();
   $s->execute("INSERT INTO delivery_runs(tenant,id,driver_id,status,request_key,revision,created_at,updated_at) VALUES(?,?,?,'planned',?,1,?,?)",[$s->tenant,$id,$driver,$requestKey,$now,$now]);
   foreach($ids as $position=>$order){$s->assign($order,$driver);$s->execute('INSERT INTO delivery_run_stops(tenant,run_id,order_id,position,active) VALUES(?,?,?,?,1)',[$s->tenant,$id,$order,$position+1]);$s->event($order,'run_planned','manager');}
   return $this->get($id);
  });
 }
 public function edit(string $id,array $body):array {
  return $this->store->transaction(function()use($id,$body){
   $s=$this->store;$run=$this->get($id);
   if($run['status']!=='planned'||($body['revision']??null)!==(int)$run['revision'])throw new ApiError('This run changed. Reload it before editing.',409);
   if(($body['action']??'')==='cancel'){
    $s->execute("UPDATE delivery_runs SET status='cancelled',revision=revision+1,updated_at=? WHERE tenant=? AND id=?",[time(),$s->tenant,$id]);
    $s->execute('UPDATE delivery_run_stops SET active=0 WHERE tenant=? AND run_id=?',[$s->tenant,$id]);
    foreach($run['orderIds'] as $order)$s->event($order,'run_cancelled','manager');
   }elseif(($body['action']??'')==='reorder'){
    $ids=$body['orderIds']??null;$expected=$run['orderIds'];$sorted=$ids;if(!is_array($ids)||!array_is_list($ids))throw new ApiError('Provide the ordered stops.');sort($expected);sort($sorted);
    if($sorted!==$expected)throw new ApiError('Keep every stop exactly once.');
    foreach($ids as $position=>$order)$s->execute('UPDATE delivery_run_stops SET position=? WHERE tenant=? AND run_id=? AND order_id=?',[$position+1,$s->tenant,$id,$order]);
    $s->execute('UPDATE delivery_runs SET revision=revision+1,updated_at=? WHERE tenant=? AND id=?',[time(),$s->tenant,$id]);
   }else throw new ApiError('Choose reorder or cancel.');
   return $this->get($id);
  });
 }
 public function start(string $id,string $driver):array {
  return $this->store->transaction(function()use($id,$driver){
   $s=$this->store;$run=$this->get($id,$driver);if($run['status']==='active')return $run;
   if($run['status']!=='planned')throw new ApiError('This run is no longer available.',409);
   foreach($run['orderIds'] as $order){$o=$s->get($order);if(!in_array($o['payment_status'],['paid','partially_refunded'],true))throw new ApiError('Confirm payment for every stop before departure.',409);$s->change($order,'out_for_delivery','driver:'.$driver,$driver,$id);}
   $s->execute("UPDATE delivery_runs SET status='active',revision=revision+1,updated_at=? WHERE tenant=? AND id=?",[time(),$s->tenant,$id]);
   return $this->get($id,$driver);
  });
 }
 public function location(string $id,array $session,string $action,array $body):array {
  return $this->store->transaction(function()use($id,$session,$action,$body){
   $s=$this->store;$run=$this->get($id,$session['subject']);
   if($run['status']!=='active'&&$action!=='stop')throw new ApiError('GPS requires an active delivery run.',403);
   $orders=array_column(array_filter($run['stops'],fn($stop)=>$stop['status']==='out_for_delivery'),'orderId');
   $key=$action==='start'?bin2hex(random_bytes(32)):Store::text($body['sharingToken']??null,64);
   foreach($orders as $order){
    if($action==='start'){$s->startLocation($order,$session,Store::text($body['source']??'device',20));$s->execute('UPDATE location_shares SET sharing_hash=? WHERE tenant=? AND order_id=?',[hash('sha256',$key),$s->tenant,$order]);}
    elseif($action==='stop')$s->stopLocation($order,$session,$key);
    elseif($action==='heartbeat')$s->heartbeatLocation($order,$session,$key);
    else $s->locate($order,$session['subject'],$body,$session);
   }
   $result=['ok'=>true,'orderIds'=>$run['orderIds']];
   if($action==='start')$result+=['sharingToken'=>$key,'expiresIn'=>120,'source'=>$body['source']??'device'];
   if($action==='update')$result+=['recordedAt'=>$body['recordedAt'],'receivedAt'=>time()];
   return $result;
  });
 }
}
