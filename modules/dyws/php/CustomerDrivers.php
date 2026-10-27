<?php
declare(strict_types=1);
namespace dyws;

/** Account blocks are store scoped and apply at every delivery address. */
final class CustomerDrivers {
 public const BLOCK_MESSAGE='Cannot assign this driver to this delivery location because the customer account has blocked them. Choose another driver.';
 public function __construct(private Store $store){}
 public static function blocked(Store $s,array $order,string $driver):bool {
  return !empty($order['customer_id'])&&$driver!==''&&(bool)$s->query('SELECT 1 FROM customer_driver_blocks WHERE tenant=? AND customer_id=? AND driver_id=?',[$s->tenant,$order['customer_id'],$driver]);
 }
 public static function assertAllowed(Store $s,array $order,string $driver):void {
  if(self::blocked($s,$order,$driver))throw new ApiError(self::BLOCK_MESSAGE,409,'customer_blocked_driver',['orderId'=>$order['id'],'driverId'=>$driver]);
 }
 private function delivered(string $customer,string $id):array {
  $s=$this->store;$o=$s->query('SELECT * FROM orders WHERE tenant=? AND id=? AND customer_id=?',[$s->tenant,$id,$customer])[0]??null;
  if(!$o)throw new ApiError('Order not found in your account.',404);
  if($o['fulfillment']!=='delivery'||$o['status']!=='delivered'||!$o['driver_id'])throw new ApiError('You can report or block a driver after your delivery is complete.',409);return $o;
 }
 public function report(string $customer,string $id,array $body):array {
  $reason=$body['reason']??'';if(!in_array($reason,['late','conduct','handling','other'],true))throw new ApiError('Choose a reason for the report.');
  $details=Store::text($body['details']??'',2000,false);$block=$body['blockDriver']??false;
  if(!is_bool($block))throw new ApiError('Choose whether to block this driver.');
  return $this->store->transaction(function()use($customer,$id,$reason,$details,$block){
   $s=$this->store;$o=$this->delivered($customer,$id);
   $existing=$s->query('SELECT reason,details FROM customer_driver_reports WHERE tenant=? AND customer_id=? AND order_id=?',[$s->tenant,$customer,$id])[0]??null;
   if($existing&&($existing['reason']!==$reason||$existing['details']!==$details))throw new ApiError('A report has already been submitted for this delivery.',409);
   if(!$existing)$s->execute('INSERT INTO customer_driver_reports(tenant,customer_id,order_id,driver_id,reason,details,created_at) VALUES(?,?,?,?,?,?,?)',[$s->tenant,$customer,$id,$o['driver_id'],$reason,$details,time()]);
   if($block)$this->addBlock($customer,$o);
   return ['ok'=>true,'driverBlocked'=>self::blocked($s,$o,$o['driver_id'])];
  });
 }
 public function block(string $customer,string $id):array {
  return $this->store->transaction(function()use($customer,$id){$this->addBlock($customer,$this->delivered($customer,$id));return ['ok'=>true,'driverBlocked'=>true];});
 }
 private function addBlock(string $customer,array $o):void {
  $s=$this->store;$s->execute('INSERT INTO customer_driver_blocks(tenant,customer_id,driver_id,source_order_id,created_at) VALUES(?,?,?,?,?) ON CONFLICT(tenant,customer_id,driver_id) DO NOTHING',[$s->tenant,$customer,$o['driver_id'],$o['id'],time()]);
  // Existing assignments remain visible to staff, but departure is rechecked under the same write lock.
 }
 public function unblock(string $customer,array $body):array {
  $driver=Store::text($body['driverId']??null,80);
  if(($body['action']??'')!=='unblock')throw new ApiError('Choose unblock.');
  $this->store->execute('DELETE FROM customer_driver_blocks WHERE tenant=? AND customer_id=? AND driver_id=?',[$this->store->tenant,$customer,$driver]);return ['ok'=>true];
 }
 public function blocks(string $customer):array {
  $s=$this->store;return $s->query("SELECT b.driver_id AS driverId,coalesce(d.name,'Driver') AS driverName,b.created_at AS createdAt FROM customer_driver_blocks b LEFT JOIN drivers d ON d.tenant=b.tenant AND d.id=b.driver_id WHERE b.tenant=? AND b.customer_id=? ORDER BY b.created_at DESC,b.driver_id",[$s->tenant,$customer]);
 }
 public function reports(int $offset=0):array {
  $s=$this->store;$rows=$s->query('SELECT r.*,d.name AS driverName,EXISTS(SELECT 1 FROM customer_driver_blocks b WHERE b.tenant=r.tenant AND b.customer_id=r.customer_id AND b.driver_id=r.driver_id) AS driverBlocked FROM customer_driver_reports r LEFT JOIN drivers d ON d.tenant=r.tenant AND d.id=r.driver_id WHERE r.tenant=? ORDER BY r.id DESC LIMIT 51 OFFSET '.max(0,$offset),[$s->tenant]);
  return ['reports'=>array_slice($rows,0,50),'nextOffset'=>count($rows)>50?$offset+50:null];
 }
 public function dispatch(array $o):array {
  $s=$this->store;$blocks=empty($o['customer_id'])?[]:$this->blocks($o['customer_id']);
  $o['blockedDriverIds']=array_column($blocks,'driverId');
  $o['assignmentWarning']=in_array($o['driver_id'],$o['blockedDriverIds'],true)?self::BLOCK_MESSAGE:null;
  $o['driverReports']=$s->query('SELECT reason,details,driver_id AS driverId,created_at AS createdAt FROM customer_driver_reports WHERE tenant=? AND order_id=?',[$s->tenant,$o['id']]);return $o;
 }
}
