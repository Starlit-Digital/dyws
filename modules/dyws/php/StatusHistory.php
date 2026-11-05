<?php
declare(strict_types=1);
namespace dyws;

/** Manager corrections for demo orders. Payment ledgers and dispatch runs are never rewound. */
final class StatusHistory {
 public function __construct(private Store $store){
  $store->db->exec('CREATE TABLE IF NOT EXISTS order_status_history (tenant TEXT NOT NULL,order_id TEXT NOT NULL,states_json TEXT NOT NULL,cursor INTEGER NOT NULL,checkpoint INTEGER NOT NULL,PRIMARY KEY(tenant,order_id),FOREIGN KEY(tenant,order_id) REFERENCES orders(tenant,id))');
  $store->db->exec('CREATE TABLE IF NOT EXISTS order_status_edits (id INTEGER PRIMARY KEY,tenant TEXT NOT NULL,order_id TEXT NOT NULL,action TEXT NOT NULL,from_status TEXT NOT NULL,to_status TEXT NOT NULL,actor TEXT NOT NULL,created_at INTEGER NOT NULL,FOREIGN KEY(tenant,order_id) REFERENCES orders(tenant,id))');
 }
 public static function steps(array $order):array {return array_merge(['placed','accepted','preparing','ready'],$order['fulfillment']==='delivery'?['out_for_delivery','delivered']:['completed']);}
 private function snapshot(string $id):array {
  $o=$this->store->get($id);$saved=$this->store->query('SELECT * FROM order_status_history WHERE tenant=? AND order_id=?',[$this->store->tenant,$id])[0]??null;
  $states=$saved?json_decode($saved['states_json'],true,512,JSON_THROW_ON_ERROR):[];$cursor=$saved?(int)$saved['cursor']:-1;$checkpoint=$saved?(int)$saved['checkpoint']:0;
  $events=$this->store->query('SELECT id,status FROM events WHERE tenant=? AND order_id=? AND id>? ORDER BY id',[$this->store->tenant,$id,$checkpoint]);
  $valid=array_merge(self::steps($o),['cancelled']);
  foreach($events as $event){$checkpoint=(int)$event['id'];if(in_array($event['status'],$valid,true)&&($states[$cursor]??null)!==$event['status']){$states=array_slice($states,0,$cursor+1);$states[]=$event['status'];$cursor=count($states)-1;}}
  if(($states[$cursor]??null)!==$o['status']){$states=array_slice($states,0,$cursor+1);$states[]=$o['status'];$cursor=count($states)-1;}
  $revision=hash('sha256',json_encode([$this->store->tenant,$id,$checkpoint,$o['status'],$o['payment_status'],$o['driver_id'],$states,$cursor]));
  return compact('o','states','cursor','checkpoint','revision');
 }
 private function guard(array $order,string $target):void {
  if($order['payment_provider']!=='demo')throw new ApiError('Status correction is available for demo orders only.',409);
  if($order['customer_cancelled_at']!==null)throw new ApiError('A customer cancellation cannot be undone here.',409);
  if((new DeliveryRuns($this->store))->membership($order['id']))throw new ApiError('Finish or cancel the dispatch run before correcting this order.',409);
  if($this->store->query('SELECT 1 FROM location_shares WHERE tenant=? AND order_id=?',[$this->store->tenant,$order['id']]))throw new ApiError('Stop location sharing before correcting this order.',409);
  if(!in_array($target,array_merge(self::steps($order),['cancelled']),true))throw new ApiError('Choose an order status for this fulfillment type.');
  if(in_array($target,['completed','delivered'],true)&&!in_array($order['payment_status'],['paid','partially_refunded'],true))throw new ApiError('Confirm demo payment before completing the order.',409);
  if(in_array($target,['out_for_delivery','delivered'],true)){
   if(!$order['driver_id']||!$this->store->query('SELECT 1 FROM drivers WHERE tenant=? AND id=? AND active=1',[$this->store->tenant,$order['driver_id']]))throw new ApiError('Assign an active driver first.',409);
   CustomerDrivers::assertAllowed($this->store,$order,$order['driver_id']);
  }
 }
 private function allowed(array $o,string $status):bool {try{$this->guard($o,$status);return true;}catch(ApiError){return false;}}
 public function summary(string $id):array {
  $s=$this->snapshot($id);$o=$s['o'];$targets=array_values(array_filter(array_merge(self::steps($o),['cancelled']),fn($target)=>$this->allowed($o,$target)));
  return ['revision'=>$s['revision'],'steps'=>self::steps($o),'editable'=>(bool)$targets,'allowedStatuses'=>$targets,'canUndo'=>$s['cursor']>0&&$this->allowed($o,$s['states'][$s['cursor']-1]),'canRedo'=>$s['cursor']<count($s['states'])-1&&$this->allowed($o,$s['states'][$s['cursor']+1]),'current'=>$o['status']];
 }
 public function apply(string $id,array $body,string $actor='manager'):array {
  return $this->store->transaction(function()use($id,$body,$actor){
   $s=$this->snapshot($id);if(!is_string($body['revision']??null)||!hash_equals($s['revision'],$body['revision']))throw new ApiError('This order changed. Refresh its status before editing.',409);
   $action=$body['action']??'';$states=$s['states'];$cursor=$s['cursor'];
   if($action==='undo'){if($cursor<=0)throw new ApiError('There is no earlier status to restore.',409);$cursor--;}
   elseif($action==='redo'){if($cursor>=count($states)-1)throw new ApiError('There is no later status to restore.',409);$cursor++;}
   elseif($action==='set'){
    $target=$body['status']??null;if(!is_string($target))throw new ApiError('Choose an order status.');
    if($target===$s['o']['status'])throw new ApiError('The order already has that status.',409);
    $states=array_slice($states,0,$cursor+1);$states[]=$target;$cursor=count($states)-1;
   }else throw new ApiError('Choose set, undo or redo.');
   $target=$states[$cursor];$this->guard($s['o'],$target);
   $this->store->plugins?->validate('order.status_changing',$this->store->safeOrder($s['o']),$target,$actor.':'.$action);
   $this->store->execute('UPDATE orders SET status=?,updated_at=? WHERE tenant=? AND id=?',[$target,time(),$this->store->tenant,$id]);
   if($target!=='out_for_delivery')$this->store->execute('DELETE FROM locations WHERE tenant=? AND order_id=?',[$this->store->tenant,$id]);
   $this->store->event($id,$target,$actor.':status-'.$action);
   $checkpoint=(int)$this->store->query('SELECT max(id) AS n FROM events WHERE tenant=? AND order_id=?',[$this->store->tenant,$id])[0]['n'];
   $this->store->execute('INSERT INTO order_status_history(tenant,order_id,states_json,cursor,checkpoint) VALUES(?,?,?,?,?) ON CONFLICT(tenant,order_id) DO UPDATE SET states_json=excluded.states_json,cursor=excluded.cursor,checkpoint=excluded.checkpoint',[$this->store->tenant,$id,json_encode($states),$cursor,$checkpoint]);
   $this->store->execute('INSERT INTO order_status_edits(tenant,order_id,action,from_status,to_status,actor,created_at) VALUES(?,?,?,?,?,?,?)',[$this->store->tenant,$id,$action,$s['o']['status'],$target,$actor,time()]);
   return ['order'=>$this->store->safeOrder($this->store->get($id)),'history'=>$this->summary($id)];
  });
 }
}
