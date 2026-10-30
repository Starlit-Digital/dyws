<?php
declare(strict_types=1);
namespace dyws\Plugins\DemoLockdown;
use dyws\{Store,ApiError};
final class DemoPolicy {
 public const CUSTOMER=['name'=>'Demo Customer','phone'=>'7805550142'];
 public const ADDRESS=['line1'=>'123 Example Avenue NW','line2'=>'','city'=>'Edmonton','region'=>'AB','postalCode'=>'T5A 1A1','country'=>'Canada'];
 public const LOCATION=['latitude'=>53.61665,'longitude'=>-113.39804,'accuracy'=>8,'name'=>'Manning Town Centre'];
 public function __construct(private array $config,private ?Store $store){}
 public static function accountFingerprint(array $config):string{$drivers=$config['drivers']??[];foreach($drivers as &$driver){unset($driver['vehicleType'],$driver['vehicleColor'],$driver['profileIcon']);}unset($driver);return hash('sha256',json_encode([$config['manager_password_hash']??'', $drivers],JSON_THROW_ON_ERROR));}
 public function installation():void {
  if(!$this->store||($this->config['driver_test_location']??null)!==self::LOCATION||!empty($this->config['realtime']))throw new ApiError('The installation configuration needs attention.',503);
  if(array_diff($this->store->plugins->activeIds(),['demo-lockdown','order-reporting','datatables','order-format','nominatim','catalog','pickup','delivery','booking']))throw new ApiError('Only approved plugins may run here.',503);
  if(!hash_equals($this->config['demo_account_fingerprint']??'',self::accountFingerprint($this->config)))throw new ApiError('Account settings need attention.',503);
  header('Permissions-Policy: geolocation=()');
  // This database is dedicated to disposable examples. Never enable this on merchant data.
  $this->store->transaction(function(){
   $this->store->execute("DELETE FROM deal_claims WHERE tenant=? AND owner LIKE 'demo:%' AND expires_at<?",[$this->store->tenant,time()]);
   $ids=$this->store->query('SELECT id FROM orders WHERE tenant=? AND created_at<?',[$this->store->tenant,time()-86400]);
   $runs=[];foreach($ids as $row)foreach($this->store->query('SELECT run_id FROM delivery_run_stops WHERE tenant=? AND order_id=?',[$this->store->tenant,$row['id']]) as $stop)$runs[$stop['run_id']]=true;
   foreach($ids as $row){foreach(['delivery_run_stops','locations','location_shares','events','payments','payment_attempts','payment_refund_deltas'] as $table)$this->store->execute("DELETE FROM $table WHERE tenant=? AND order_id=?",[$this->store->tenant,$row['id']]);$this->store->execute('DELETE FROM orders WHERE tenant=? AND id=?',[$this->store->tenant,$row['id']]);$this->store->execute('DELETE FROM realtime_versions WHERE channel=?',[$this->store->tenant.':order:'.$row['id']]);}
   // Expiring one example must not strand the remaining stops or block the driver.
   $channels=[];foreach(array_keys($runs) as $id){
    $stops=$this->store->query('SELECT order_id,active FROM delivery_run_stops WHERE tenant=? AND run_id=? ORDER BY position',[$this->store->tenant,$id]);
    if(!$stops){$this->store->execute('DELETE FROM delivery_runs WHERE tenant=? AND id=?',[$this->store->tenant,$id]);continue;}
    foreach($stops as $position=>$stop){$this->store->execute('UPDATE delivery_run_stops SET position=? WHERE tenant=? AND run_id=? AND order_id=?',[$position+1,$this->store->tenant,$id,$stop['order_id']]);$channels[]=$this->store->tenant.':order:'.$stop['order_id'];}
    $this->store->execute("UPDATE delivery_runs SET status=CASE WHEN status IN ('planned','active') AND ?=0 THEN 'completed' ELSE status END,revision=revision+1,updated_at=? WHERE tenant=? AND id=?",[array_sum(array_column($stops,'active')),time(),$this->store->tenant,$id]);
   }
   // Cancel and recreate attempts must not accumulate unbounded run history.
   $old=$this->store->query("SELECT id FROM delivery_runs WHERE tenant=? AND status IN ('completed','cancelled') AND created_at<?",[$this->store->tenant,time()-86400]);
   foreach($old as $run){$this->store->execute('DELETE FROM delivery_run_stops WHERE tenant=? AND run_id=?',[$this->store->tenant,$run['id']]);$this->store->execute('DELETE FROM delivery_runs WHERE tenant=? AND id=?',[$this->store->tenant,$run['id']]);}
   if($ids)(new \dyws\Realtime($this->config,$this->store))->changed(array_merge([$this->store->tenant.':operators'],$channels));
   $this->store->execute('DELETE FROM sessions WHERE expires_at<?',[time()]);$this->store->execute('DELETE FROM limits WHERE expires_at<?',[time()]);
  });
 }
 public function request(string $method,string $route,array $body):void {
  // Unknown endpoints, new plugins and future mutations are blocked by default.
  $reads=['/deals','/customer/deals','/manager/deals','/customer/session','/manager/customer-reports','/guest-details','/plugins/nominatim/config','/manager/plugins/nominatim/settings','/health','/plugins','/catalog','/settings','/realtime/config','/manager/orders','/manager/reports','/manager/lookup','/manager/catalog','/manager/settings','/manager/drivers','/manager/driver-locations','/manager/plugins','/manager/plugins/order-reporting/dashboard','/manager/plugins/order-reporting/export-options','/plugins/order-format/layouts','/manager/plugins/order-format/templates','/driver/orders','/driver/gps-config','/driver/profile'];
  $allowed=$method==='GET'&&(in_array($route,$reads,true)||preg_match('~^/tracking/[A-Z]{2,7}-[A-F0-9]{12}$~D',$route));
  if($method==='POST')$allowed=in_array($route,['/customer/deals/claim','/customer/deals/activate','/customer/deals/quote','/manager/plugins/order-reporting/export','/guest-details','/plugins/nominatim/search','/login','/logout','/orders','/pickup/preview','/pickup/availability','/realtime/access','/driver/profile'],true)||preg_match('~^/manager/orders/[A-Z]{2,7}-[A-F0-9]{12}/(status|assign|payment)$~D',$route)||preg_match('~^/driver/orders/[A-Z]{2,7}-[A-F0-9]{12}/(status|payment|location(?:/(?:start|stop|heartbeat))?)$~D',$route);
  if($method==='POST'&&preg_match('~^/tracking/[A-Z]{2,7}-[A-F0-9]{12}/cancel$~D',$route))$allowed=true;
  if($method==='POST'&&($route==='/manager/runs'||preg_match('~^/manager/runs/RUN-[A-F0-9]{12}$~D',$route)||preg_match('~^/driver/runs/RUN-[A-F0-9]{12}/(?:start|location(?:/(?:start|stop|heartbeat))?)$~D',$route)))$allowed=true;
  // Explicit owner opt in permits only scoped report reads. Public demo manager
  // credentials still cannot issue keys, export reports or enable other commands.
  $reportPilot=($this->config['demo_integration_reports']??false)===true;
  $summaryRoute='/integrations/v1/commands/reports.summary/execute';
  if($reportPilot&&(($method==='GET'&&in_array($route,['/integrations/v1/commands','/integrations/v1/commands/reports.summary'],true))||(in_array($method,['POST','QUERY'],true)&&$route===$summaryRoute)))$allowed=true;
  if($method==='GET'&&in_array($route,['/plugins/booking/services','/manager/plugins/booking/appointments','/manager/plugins/booking/settings'],true))$allowed=true;
  if($method==='POST'&&in_array($route,['/plugins/booking/availability','/plugins/booking/reserve','/plugins/booking/cancel','/manager/plugins/booking/appointments'],true))$allowed=true;
  if(!$allowed)throw new ApiError('This setting is locked by the installation owner.',403);
  if($method==='POST'&&$route==='/manager/runs'&&$this->store->query('SELECT count(*) AS n FROM delivery_runs WHERE tenant=?',[$this->store->tenant])[0]['n']>=500&&!$this->store->query('SELECT id FROM delivery_runs WHERE tenant=? AND request_key=?',[$this->store->tenant,is_string($body['idempotencyKey']??null)?$body['idempotencyKey']:'']))throw new ApiError('The order limit has been reached. Please try again later.',429);
  if($method==='POST'&&!in_array($route,['/login','/realtime/access'],true)&&!($reportPilot&&$route===$summaryRoute))\dyws_limit_requests($this->store,$this->config,'demo-writes',60,60);
 }
 public function login(array $body):void {
  if(($body['role']??'')==='manager'&&($body['username']??'')!=='admin')throw new ApiError('Use admin / admin to sign in.',401);
  if(($body['role']??'')==='driver'&&($body['driverId']??'')!=='driver')throw new ApiError('Use driver / driver to sign in.',401);
  if($this->store->query('SELECT count(*) AS n FROM sessions WHERE tenant=? AND expires_at>?',[$this->store->tenant,time()])[0]['n']>=500)throw new ApiError('The service is busy. Please try again later.',429);
 }
 /** Recover the existing capability for an authenticated Admin preview, without renewing it. */
 public function trackingAccess(string $id):string {
  if(!preg_match('/^DYWS-[A-F0-9]{12}$/D',$id)||!$this->store)throw new ApiError('This tracking link is unavailable or has expired.',404);
  $order=$this->store->get($id);
  $token=hash_hmac('sha256',$id.'|'.$order['request_key'],$this->config['tracking_secret']);
  // Check the saved hash and expiry exactly as an ordinary customer request does.
  $this->store->tracking($id,$token);
  return $token;
 }
 public function orderInput(array $body):array {
  $hasEmail=isset($body['customer']['email']);$body['customer']=self::CUSTOMER;if($hasEmail)$body['customer']['email']='demo.customer@example.test';$body['notes']='';$body['pluginData']=[];
  // Keep retries of existing demo orders tied to their original contact fingerprint.
  if($this->store&&is_string($body['idempotencyKey']??null)){
   $saved=$this->store->query('SELECT customer_name,customer_email FROM orders WHERE tenant=? AND request_key=?',[$this->store->tenant,$body['idempotencyKey']])[0]??null;
   if($saved&&in_array($saved['customer_name'],['Jordan Taylor',self::CUSTOMER['name']],true)){
    $body['customer']['name']=$saved['customer_name'];
    if($hasEmail&&in_array($saved['customer_email'],['jordan@example.test','demo.customer@example.test'],true))$body['customer']['email']=$saved['customer_email'];
   }
  }
  unset($body['address'],$body['addressDetails']);
  if(($body['fulfillment']??'')==='delivery')$body['addressDetails']=self::ADDRESS;
  return $body;
 }
 public function order(array $order):void {
  $address=implode(', ',array_filter(self::ADDRESS));
  $customer=$order['customer'];if(isset($customer['email'])){if($customer['email']!=='demo.customer@example.test')throw new ApiError('Use the provided customer details.',403);unset($customer['email']);}
  if($customer!==self::CUSTOMER||$order['notes']!==''||!empty($order['pluginData'])||($order['fulfillment']==='delivery'&&($order['address']!==$address||$order['addressDetails']!==self::ADDRESS)))throw new ApiError('Use the provided customer details.',403);
  if($this->store->query('SELECT count(*) AS n FROM orders WHERE tenant=?',[$this->store->tenant])[0]['n']>=500)throw new ApiError('The order limit has been reached. Please try again later.',429);
 }
 /** Present the current fictional customer consistently without rewriting order receipts. */
 public function response(array $value,string $route,string $method):array {
  $normalize=function(array $row)use(&$normalize):array{
   foreach($row as $key=>$item){
    if(is_array($item))$row[$key]=$normalize($item);
    elseif($key==='customer_name'&&$item==='Jordan Taylor')$row[$key]=self::CUSTOMER['name'];
    elseif($key==='customer_email'&&$item==='jordan@example.test')$row[$key]='demo.customer@example.test';
   }
   if(isset($row['customer'])&&is_array($row['customer'])){
    if(($row['customer']['name']??'')==='Jordan Taylor')$row['customer']['name']=self::CUSTOMER['name'];
    if(($row['customer']['email']??'')==='jordan@example.test')$row['customer']['email']='demo.customer@example.test';
   }
   return $row;
  };
  return $normalize($value);
 }
 public function presentation(array $value,string $page):array {
  $value['customerNavigationLocked']=true;
  if($page==='customer-signin')$value['customerSignInLocked']=true;
  $value['notice']='Admin: admin / admin. Driver: driver / driver. Settings are locked.';
  $value['username']='admin';$value['driverId']='driver';$value['gpsMessage']='Using a simulated Manning Town Centre location. Device location is not requested.';return $value;
 }
}
