<?php
declare(strict_types=1);
namespace dyws\Plugins\DemoLockdown;
use dyws\{Store,ApiError};
final class DemoPolicy {
 public const CUSTOMER=['name'=>'Demo Customer','phone'=>'7805550142'];
 public const ADDRESS=['line1'=>'123 Example Avenue NW','line2'=>'','city'=>'Edmonton','region'=>'AB','postalCode'=>'T5A 1A1','country'=>'Canada'];
 public const LOCATION=['latitude'=>53.61665,'longitude'=>-113.39804,'accuracy'=>8,'name'=>'Manning Town Centre demo'];
 public function __construct(private array $config,private ?Store $store){}
 public static function accountFingerprint(array $config):string{return hash('sha256',json_encode([$config['manager_password_hash']??'', $config['drivers']??[]],JSON_THROW_ON_ERROR));}
 public function installation():void {
  if(!$this->store||($this->config['driver_test_location']??null)!==self::LOCATION||!empty($this->config['realtime']))throw new ApiError('The public demo configuration needs attention.',503);
  if(array_diff($this->store->plugins->activeIds(),['demo-lockdown','order-reporting','datatables']))throw new ApiError('Only demo approved plugins may run here.',503);
  if(!hash_equals($this->config['demo_account_fingerprint']??'',self::accountFingerprint($this->config)))throw new ApiError('Public demo accounts need attention.',503);
  header('Permissions-Policy: geolocation=()');
  // This database is dedicated to disposable examples. Never enable this on merchant data.
  $this->store->transaction(function(){
   $ids=$this->store->query('SELECT id FROM orders WHERE tenant=? AND created_at<?',[$this->store->tenant,time()-86400]);
   foreach($ids as $row){foreach(['locations','location_shares','events','payments','payment_attempts','payment_refund_deltas'] as $table)$this->store->execute("DELETE FROM $table WHERE tenant=? AND order_id=?",[$this->store->tenant,$row['id']]);$this->store->execute('DELETE FROM orders WHERE tenant=? AND id=?',[$this->store->tenant,$row['id']]);$this->store->execute('DELETE FROM realtime_versions WHERE channel=?',[$this->store->tenant.':order:'.$row['id']]);}
   $this->store->execute('DELETE FROM sessions WHERE expires_at<?',[time()]);$this->store->execute('DELETE FROM limits WHERE expires_at<?',[time()]);
  });
 }
 public function request(string $method,string $route,array $body):void {
  // Unknown endpoints, new plugins and future mutations are blocked by default.
  $reads=['/health','/plugins','/catalog','/settings','/realtime/config','/manager/orders','/manager/reports','/manager/lookup','/manager/catalog','/manager/settings','/manager/drivers','/manager/driver-locations','/manager/plugins','/manager/plugins/order-reporting/dashboard','/driver/orders','/driver/gps-config'];
  $allowed=$method==='GET'&&(in_array($route,$reads,true)||preg_match('~^/tracking/[A-Z]{2,7}-[A-F0-9]{12}$~D',$route));
  if($method==='POST')$allowed=in_array($route,['/login','/logout','/orders','/realtime/access'],true)||preg_match('~^/manager/orders/[A-Z]{2,7}-[A-F0-9]{12}/(status|assign|payment)$~D',$route)||preg_match('~^/driver/orders/[A-Z]{2,7}-[A-F0-9]{12}/(status|location(?:/(?:start|stop|heartbeat))?)$~D',$route);
  if(!$allowed)throw new ApiError('This setting is locked in the public demo.',403);
  if($method==='POST'&&!in_array($route,['/login','/realtime/access'],true))\dyws_limit_requests($this->store,$this->config,'demo-writes',60,60);
 }
 public function login(array $body):void {
  if(($body['role']??'')==='manager'&&($body['username']??'')!=='admin')throw new ApiError('Use admin / admin for this public demo.',401);
  if(($body['role']??'')==='driver'&&($body['driverId']??'')!=='driver')throw new ApiError('Use driver / driver for this public demo.',401);
  if($this->store->query('SELECT count(*) AS n FROM sessions WHERE tenant=? AND expires_at>?',[$this->store->tenant,time()])[0]['n']>=500)throw new ApiError('The public demo is busy. Please try again later.',429);
 }
 public function orderInput(array $body):array {
  $body['customer']=self::CUSTOMER;$body['notes']='Public demonstration only.';$body['pluginData']=[];
  unset($body['address'],$body['addressDetails']);
  if(($body['fulfillment']??'')==='delivery')$body['addressDetails']=self::ADDRESS;
  return $body;
 }
 public function order(array $order):void {
  $address=implode(', ',array_filter(self::ADDRESS));
  if($order['customer']!==self::CUSTOMER||$order['notes']!=='Public demonstration only.'||!empty($order['pluginData'])||($order['fulfillment']==='delivery'&&($order['address']!==$address||$order['addressDetails']!==self::ADDRESS)))throw new ApiError('Only fictional customer details are allowed in this demo.',403);
  if($this->store->query('SELECT count(*) AS n FROM orders WHERE tenant=?',[$this->store->tenant])[0]['n']>=500)throw new ApiError('The demo is full. Examples expire after 24 hours.',429);
 }
 public function presentation(array $value,string $page):array {
  $value['notice']='Public demo. Admin: admin / admin. Driver: driver / driver. Critical settings are locked. Orders are shared examples and expire after 24 hours.';
  $value['username']='admin';$value['driverId']='driver';$value['gpsMessage']='This demo uses a simulated Manning Town Centre location. Your device location is never requested.';return $value;
 }
}
