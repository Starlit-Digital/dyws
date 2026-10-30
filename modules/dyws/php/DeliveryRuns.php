<?php
declare(strict_types=1);
namespace dyws;

/** A dispatch run owns a fixed, ordered set of deliveries until it finishes. */
class DeliveryRuns {
 public function __construct(protected Store $store){}
 public function get(string $id,?string $driver=null):array {
  $s=$this->store;$run=$s->query('SELECT * FROM delivery_runs WHERE tenant=? AND id=?',[$s->tenant,$id])[0]??null;
  if(!$run)throw new ApiError('Delivery run not found.',404);
  if($driver!==null&&$run['driver_id']!==$driver)throw new ApiError('This run is not assigned to you.',403);
  $run['stops']=$s->query('SELECT ds.order_id AS orderId,ds.position,o.status,o.customer_name AS customerName,o.address FROM delivery_run_stops ds JOIN orders o ON o.tenant=ds.tenant AND o.id=ds.order_id WHERE ds.tenant=? AND ds.run_id=? ORDER BY ds.position',[$s->tenant,$id]);
  $run['orderIds']=array_column($run['stops'],'orderId');
  $run['nextOrderId']=null;foreach($run['stops'] as $stop)if($stop['status']!=='delivered'){$run['nextOrderId']=$stop['orderId'];break;}
  return $run;
 }
 public function listing(?string $driver=null):array {
  $s=$this->store;$args=[$s->tenant];$sql="SELECT id FROM delivery_runs WHERE tenant=? AND status IN ('planned','active')";
  if($driver!==null){$sql.=' AND driver_id=?';$args[]=$driver;}
  return array_map(fn($r)=>$this->get($r['id'],$driver),$s->query($sql.' ORDER BY created_at,id',$args));
 }
 public function membership(string $order):?array {
  $s=$this->store;return $s->query('SELECT r.id,r.status,r.driver_id,ds.position FROM delivery_run_stops ds JOIN delivery_runs r ON r.tenant=ds.tenant AND r.id=ds.run_id WHERE ds.tenant=? AND ds.order_id=? AND ds.active=1',[$s->tenant,$order])[0]??null;
 }
 public function progress(string $order):?array {
  $m=$this->membership($order);if(!$m||$m['status']!=='active')return null;
  $s=$this->store;$ahead=$s->query('SELECT count(*) AS n FROM delivery_run_stops WHERE tenant=? AND run_id=? AND active=1 AND position<?',[$s->tenant,$m['id'],$m['position']])[0]['n'];
  // Public projection deliberately omits run identifiers, other stops and contacts.
  return ['stopsAhead'=>(int)$ahead,'isNext'=>$ahead==0];
 }



 /** Remove only this stop from an unstarted run, retaining the cancellation event. */
 public function removeCancelledOrder(string $order):void {
  $m=$this->membership($order);if(!$m)return;
  if($m['status']!=='planned')throw new ApiError('This delivery has already left the store.',409);
  $s=$this->store;$s->execute('DELETE FROM delivery_run_stops WHERE tenant=? AND run_id=? AND order_id=?',[$s->tenant,$m['id'],$order]);
  $left=$s->query('SELECT order_id FROM delivery_run_stops WHERE tenant=? AND run_id=? ORDER BY position',[$s->tenant,$m['id']]);
  foreach($left as $position=>$stop)$s->execute('UPDATE delivery_run_stops SET position=? WHERE tenant=? AND run_id=? AND order_id=?',[$position+1,$s->tenant,$m['id'],$stop['order_id']]);
  $s->execute('UPDATE delivery_runs SET status=?,revision=revision+1,updated_at=? WHERE tenant=? AND id=?',[$left?'planned':'cancelled',time(),$s->tenant,$m['id']]);
  $s->event($order,'run_stop_cancelled','customer');
 }
 public function guardChange(string $order,string $status,?string $startingRun):void {
  $m=$this->membership($order);if(!$m)return;
  if($status==='out_for_delivery'&&$startingRun===$m['id']&&$m['status']==='planned')return;
  if($status==='delivered'&&$m['status']==='active'&&$this->get($m['id'])['nextOrderId']===$order)return;
  throw new ApiError($m['status']==='planned'?'Use the delivery run to start these orders, or cancel the run to edit them.':'Complete the next stop in this delivery run first.',409);
 }
 public function completed(string $order):void {
  $m=$this->membership($order);if(!$m)return;$s=$this->store;
  $s->execute('UPDATE delivery_run_stops SET active=0 WHERE tenant=? AND order_id=? AND active=1',[$s->tenant,$order]);
  $left=$s->query('SELECT order_id FROM delivery_run_stops WHERE tenant=? AND run_id=? AND active=1',[$s->tenant,$m['id']]);
  $s->execute('UPDATE delivery_runs SET status=?,revision=revision+1,updated_at=? WHERE tenant=? AND id=?',[$left?'active':'completed',time(),$s->tenant,$m['id']]);
 }

}
