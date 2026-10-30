<?php
declare(strict_types=1);
namespace dyws;
use PDO;
require_once __DIR__.'/DeliveryRuns.php';
require_once __DIR__.'/Catalog.php';
require_once __DIR__.'/Tips.php';
require_once __DIR__.'/Fulfillment.php';
require_once __DIR__.'/DriverTips.php';
require_once __DIR__.'/CustomerDrivers.php';
require_once __DIR__.'/DeliveryAddresses.php';
use RuntimeException;
final class ApiError extends RuntimeException {public function __construct(string $message,public int $http=422,public ?string $errorCode=null,public array $context=[]){parent::__construct($message);}}
final class Store {
 private int $transactionDepth=0;
 public PDO $db; private array $catalog; public string $tenant; public ?Plugins $plugins=null;private ?Plugins $businessRuntime=null;private string $databasePath;
 public function __construct(string $path,array $catalog,string $tenant='dyws-diner',private string $timeZone='America/Edmonton',private bool $acceptingOrders=true) {
  if(strlen($GLOBALS['dyws_config']['tracking_secret']??'')<32)throw new RuntimeException('Tracking secret must be configured.');$this->catalog=$catalog;$this->tenant=$tenant;$this->databasePath=$path;
  $this->db=new PDO('sqlite:'.$path,null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
  $this->db->exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;');
  // Rename the old provider tables atomically before creating the neutral ledger schema.
  $this->transaction(function(){
   foreach(['stripe_attempts'=>'payment_attempts','stripe_events'=>'payment_events','stripe_refund_deltas'=>'payment_refund_deltas'] as $old=>$new){
    if($this->query("SELECT name FROM sqlite_master WHERE type='table' AND name=?",[$old])&&!$this->query("SELECT name FROM sqlite_master WHERE type='table' AND name=?",[$new]))$this->db->exec("ALTER TABLE $old RENAME TO $new");
   }
   $this->db->exec(file_get_contents(__DIR__.'/schema.sql'));
  $columns=array_column($this->query('PRAGMA table_info(orders)'),'name');
  foreach(['discount'=>'INTEGER NOT NULL DEFAULT 0 CHECK(discount>=0)','deal_json'=>"TEXT NOT NULL DEFAULT '{}'",'customer_email'=>"TEXT NOT NULL DEFAULT ''",'customer_id'=>'TEXT','cancellation_window_minutes'=>'INTEGER NOT NULL DEFAULT 0 CHECK(cancellation_window_minutes BETWEEN 0 AND 1440)','customer_cancelled_at'=>'INTEGER','cancellation_payment_state'=>"TEXT NOT NULL DEFAULT ''",'fulfillment_meta_json'=>"TEXT NOT NULL DEFAULT '{}'",'tip'=>'INTEGER NOT NULL DEFAULT 0 CHECK(tip>=0 AND tip%100=0)', 'currency'=>"TEXT NOT NULL DEFAULT 'CAD'",'payment_provider'=>"TEXT NOT NULL DEFAULT 'demo'",'address_json'=>"TEXT NOT NULL DEFAULT '{}'",'plugin_data_json'=>"TEXT NOT NULL DEFAULT '{}'",'order_location_json'=>"TEXT NOT NULL DEFAULT '{}'"] as $column=>$definition)if(!in_array($column,$columns,true))$this->db->exec("ALTER TABLE orders ADD COLUMN $column $definition");
  $this->db->exec(file_get_contents(__DIR__.'/customers.sql'));
  $this->db->exec(file_get_contents(__DIR__.'/deals.sql'));
  if(!in_array('customer_email',array_column($this->query('PRAGMA table_info(guest_details)'),'name'),true))$this->db->exec("ALTER TABLE guest_details ADD COLUMN customer_email TEXT NOT NULL DEFAULT ''");
  if(!in_array('delivery_address_id',$columns,true))$this->db->exec('ALTER TABLE orders ADD COLUMN delivery_address_id TEXT');
  if(!in_array('delivery_address_id',array_column($this->query('PRAGMA table_info(guest_addresses)'),'name'),true))$this->db->exec('ALTER TABLE guest_addresses ADD COLUMN delivery_address_id TEXT');
  $this->db->exec(file_get_contents(__DIR__.'/delivery-addresses.sql'));
  (new DeliveryAddresses($this))->backfill();
  $refundColumns=array_column($this->query('PRAGMA table_info(payment_refund_deltas)'),'name');
  if(!in_array('tip',$refundColumns,true))$this->db->exec('ALTER TABLE payment_refund_deltas ADD COLUMN tip INTEGER NOT NULL DEFAULT 0 CHECK(tip>=0)');
  });
 }
 public function businessPlugins():Plugins {
  if($this->plugins)return $this->plugins;
  require_once __DIR__.'/Plugins.php';
  $config=array_replace($GLOBALS['dyws_config']??[],['database'=>$this->databasePath,'tenant'=>$this->tenant]);
  return $this->businessRuntime??=new Plugins($config,$config['plugins_path']??null,$this);
 }
 public function businessContext():array{return ['catalog'=>$this->catalog,'timeZone'=>$this->timeZone];}
 public function transaction(callable $fn){
  $depth=$this->transactionDepth;$savepoint='dyws_tx_'.$depth;
  $this->db->exec($depth?'SAVEPOINT '.$savepoint:'BEGIN IMMEDIATE');$this->transactionDepth++;
  try{$r=$fn();$this->db->exec($depth?'RELEASE SAVEPOINT '.$savepoint:'COMMIT');return $r;}
  catch(\Throwable $e){if($depth){$this->db->exec('ROLLBACK TO SAVEPOINT '.$savepoint);$this->db->exec('RELEASE SAVEPOINT '.$savepoint);}else $this->db->exec('ROLLBACK');throw $e;}
  finally{$this->transactionDepth--;}
 }
 public function query(string $sql,array $args=[]):array{$s=$this->db->prepare($sql);$s->execute($args);return $s->fetchAll();}
 public function execute(string $sql,array $args=[]):void{$s=$this->db->prepare($sql);$s->execute($args);}
 public static function text($value,int $max,bool $required=true):string {if(!is_string($value)||strlen(trim($value))>$max||($required&&trim($value)===''))throw new ApiError('Check the required fields.');return trim($value);}
 public static function email(mixed $value,bool $required=false):string {
  $email=strtolower(self::text($value,254,$required));
  if(($email!==''||$required)&&(!filter_var($email,FILTER_VALIDATE_EMAIL)||preg_match('/[\r\n]/',$email)))throw new ApiError('Enter a valid email address.');
  return $email;
 }


 public function deals():Deals{return new Deals($this,$this->catalog,$this->timeZone);}
 public function priceCart(mixed $input):array {return $this->businessPlugins()->invoke('catalog','cart.price',$this->catalog,$input);}
 public function quoteCheckout(array $body,?string $owner):array {
  $cart=$this->priceCart($body['lines']??null);$claim=self::text($body['dealClaimId']??'',80,false);$quote=$this->deals()->quote($cart['lines'],$owner,$claim);
  $fulfillment=$body['fulfillment']??'pickup';if(!in_array($fulfillment,['pickup','delivery'],true))throw new ApiError('Choose pickup or delivery.');
  $locations=array_values(array_filter($this->catalog['locations']??[],fn($l)=>$l['active']));$location=self::text($body['locationId']??(count($locations)===1?$locations[0]['id']:''),80,false);Catalog::orderLocation($this->catalog,$location);
  $fee=Catalog::deliveryCharge($this->catalog,$quote['subtotal'],$fulfillment,$location);$tax=(int)round(($quote['subtotal']+$fee)*$this->catalog['taxBasisPoints']/10000);$tip=Tips::validate($body['tip']??0);
  return ['grossSubtotal'=>$cart['subtotal'],'subtotal'=>$quote['subtotal'],'discount'=>$quote['discount'],'deal'=>$quote['deal'],'deliveryFee'=>$fee,'tax'=>$tax,'tip'=>$tip,'total'=>$quote['subtotal']+$fee+$tax+$tip];
 }
 public static function manualPayment(string $provider):bool{return in_array($provider,['demo','pay-at-door','pay-at-restaurant'],true);}
 public static function paymentMethod(string $provider):string{return match($provider){'pay-at-door'=>'pay_at_door','pay-at-restaurant'=>'pay_at_restaurant',default=>'pay_now'};}
 public function create(array $body,string $paymentProvider='demo',?string $customerId=null,?string $dealOwner=null):array {
  $dealOwner??=$customerId;$claimId=self::text($body['dealClaimId']??'',80,false);
  $paymentMethod=$body['paymentMethod']??'pay_now';if(!is_string($paymentMethod)||!in_array($paymentMethod,['pay_now','pay_at_door','pay_at_restaurant'],true))throw new ApiError('Choose Pay now or Pay at the door.');
  if($paymentMethod==='pay_at_door'){if(($this->catalog['allowPayAtDoor']??false)!==true||($body['fulfillment']??'pickup')!=='delivery')throw new ApiError('Pay at the door is not available for this order.');$paymentProvider='pay-at-door';}
  elseif($paymentMethod==='pay_at_restaurant'){if(($this->catalog['allowPayAtPickup']??false)!==true||($body['fulfillment']??'pickup')!=='pickup')throw new ApiError('Pay at pickup is not available for this order.');$paymentProvider='pay-at-restaurant';}
  elseif(in_array($paymentProvider,['pay-at-door','pay-at-restaurant'],true))throw new ApiError('Invalid payment choice.');
  $body=$this->plugins?->applyFilters('order.input',$body)??$body;
  $this->plugins?->requirePlugin('catalog');
  $this->plugins?->requirePlugin(($body['fulfillment']??'pickup')==='delivery'?'delivery':'pickup');
  $key=self::text($body['idempotencyKey']??null,80);if(!preg_match('/^[A-Za-z0-9-]{16,80}$/',$key))throw new ApiError('Invalid request key.');
  $customer=$body['customer']??[];$name=self::text($customer['name']??null,100);$phone=self::text($customer['phone']??null,30);if(!preg_match('/^[0-9+() .-]{7,30}$/',$phone))throw new ApiError('Enter a phone number.');
  $email=self::email($customer['email']??'');$contactEmail=$email;
  if($customerId!==null){
   $account=$this->query('SELECT email FROM customers WHERE tenant=? AND id=?',[$this->tenant,$customerId])[0]??null;
   if(!$account)throw new ApiError('Customer account not found.',401);
   if($email!==''&&$email!==$account['email'])throw new ApiError('Your signed in account changed. Review your email and order again.',409);
   $contactEmail=$account['email'];
  }
  $notes=self::text($body['notes']??'',500,false);$fulfillment=$body['fulfillment']??'pickup';if(!in_array($fulfillment,['pickup','delivery'],true))throw new ApiError('Choose pickup or delivery.');
  $pickupSchedule=$this->businessPlugins()->invoke($fulfillment,'schedule.normalize',$body['pickupSchedule']??null);
  $addressDetails=null;if($fulfillment==='delivery'&&array_key_exists('addressDetails',$body)){if(!is_array($body['addressDetails']))throw new ApiError('Provide a delivery street address.');$addressDetails=[];foreach(['line1'=>120,'line2'=>60,'city'=>80,'region'=>60,'postalCode'=>20,'country'=>60] as $field=>$max)$addressDetails[$field]=self::text($body['addressDetails'][$field]??'', $max,$field==='line1');if($addressDetails['postalCode']!==''&&in_array(strtolower($addressDetails['country']),['ca','canada'],true)&&!preg_match('/^[A-Z]\d[A-Z] ?\d[A-Z]\d$/i',$addressDetails['postalCode']))throw new ApiError('Enter a valid Canadian postal code.');$body['address']=implode(', ',array_filter($addressDetails,fn($v)=>$v!==''));}
  $address=$fulfillment==='delivery'?self::text($body['address']??null,240):'';
  $availableLocations=array_values(array_filter($this->catalog['locations']??[],fn($location)=>$location['active']));
  $locationId=self::text($body['locationId']??(count($availableLocations)===1?$availableLocations[0]['id']:''),80,false);
  $cart=$this->priceCart($body['lines']??null);$lines=$cart['lines'];$subtotal=$cart['subtotal'];
  $fee=Catalog::deliveryCharge($this->catalog,$subtotal,$fulfillment,$locationId);$tax=(int)round(($subtotal+$fee)*$this->catalog['taxBasisPoints']/10000);$tip=Tips::validate(array_key_exists('tip',$body)?$body['tip']:0);$total=$subtotal+$fee+$tax+$tip;
  $pluginData=$body['pluginData']??[];if(!is_array($pluginData)||count($pluginData)>20||strlen(json_encode($pluginData,JSON_THROW_ON_ERROR))>8192)throw new ApiError('Additional order fields are too large.');
  foreach($pluginData as $plugin=>$value)if(!is_string($plugin)||!preg_match('/^[a-z][a-z0-9-]{0,59}$/D',$plugin)||!is_array($value))throw new ApiError('Invalid additional order fields.');
  $canonical=['lines'=>$lines,'customer'=>['name'=>$name,'phone'=>$phone],'notes'=>$notes,'fulfillment'=>$fulfillment,'address'=>$address];if($addressDetails!==null)$canonical['addressDetails']=$addressDetails;if($pluginData)$canonical['pluginData']=$pluginData;if($locationId!=='')$canonical['locationId']=$locationId;if($tip)$canonical['tip']=$tip;if($pickupSchedule)$canonical['pickupSchedule']=$pickupSchedule;if($customerId!==null)$canonical['customerId']=$customerId;if($email!=='')$canonical['customer']['email']=$email;if($paymentMethod!=='pay_now')$canonical['paymentMethod']=$paymentMethod;if($claimId!==''){$canonical['dealClaimId']=$claimId;$canonical['dealOwner']=$dealOwner;}$fingerprint=hash('sha256',json_encode($canonical));
  return $this->transaction(function()use($key,$fingerprint,$canonical,$subtotal,$fee,$tax,$tip,$total,$paymentProvider,$contactEmail,$claimId,$dealOwner){
   $existing=$this->query('SELECT * FROM orders WHERE tenant=? AND request_key=?',[$this->tenant,$key]);
   if($existing){if(!hash_equals($existing[0]['fingerprint'],$fingerprint))throw new ApiError('Request key was already used for a different order.',409);return $this->receipt($existing[0],$key);}
   if(!$this->acceptingOrders)throw new ApiError('Online ordering is temporarily paused. Please contact the business or try again later.',409);
   $quote=$this->deals()->quote($canonical['lines'],$dealOwner,$claimId);$canonical['lines']=$quote['lines'];$subtotal=$quote['subtotal'];$discount=$quote['discount'];$fee=Catalog::deliveryCharge($this->catalog,$subtotal,$canonical['fulfillment'],$canonical['locationId']??'');$tax=(int)round(($subtotal+$fee)*$this->catalog['taxBasisPoints']/10000);$total=$subtotal+$fee+$tax+$tip;
   $orderLocation=Catalog::orderLocation($this->catalog,$canonical['locationId']??'');
   $policy=Catalog::locationPolicy($this->catalog,$orderLocation['id']);
   if(!BusinessHours::isOpen($policy['orderingHours']??null,new \DateTimeImmutable('now',new \DateTimeZone($this->timeZone))))throw new ApiError('Online ordering is closed for this location. Please check its ordering hours ('.$this->timeZone.').',409);
   $fulfillmentMeta=$this->businessPlugins()->invoke($canonical['fulfillment'],'fulfillment.create',$canonical['pickupSchedule']??null,$this->timeZone,$orderLocation['id'],$policy);
   $this->plugins?->validate('order.validating',$canonical,['subtotal'=>$subtotal,'tax'=>$tax,'deliveryFee'=>$fee,'tip'=>$tip,'total'=>$total,'currency'=>$this->catalog['currency']]);
   $id='DYWS-'.strtoupper(bin2hex(random_bytes(6)));$token=hash_hmac('sha256',$id.'|'.$key,$GLOBALS['dyws_config']['tracking_secret']);
   $now=time();$this->execute('INSERT INTO orders(id,tenant,request_key,fingerprint,tracking_hash,tracking_expires,status,payment_status,fulfillment,customer_name,customer_phone,address,notes,lines_json,subtotal,tax,delivery_fee,total,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[$id,$this->tenant,$key,$fingerprint,hash('sha256',$token),max($now,$fulfillmentMeta['scheduledAt']??0)+86400,'placed','unpaid',$canonical['fulfillment'],$canonical['customer']['name'],$canonical['customer']['phone'],$canonical['address'],$canonical['notes'],json_encode($canonical['lines']),$subtotal,$tax,$fee,$total,$now,$now]);
   if($discount){$this->execute('UPDATE orders SET discount=?,deal_json=? WHERE tenant=? AND id=?',[$discount,json_encode($quote['deal'],JSON_THROW_ON_ERROR),$this->tenant,$id]);$this->deals()->redeem($dealOwner,$claimId,$id);}
   $cancellation=Cancellation::policy($policy['customerCancellation']??null);
   if($cancellation['enabled']&&!self::manualPayment($paymentProvider)&&!$this->plugins?->supportsPaymentCancellation($paymentProvider))throw new ApiError('This location needs a payment plugin with automatic cancellation support.',503);
   $this->execute('UPDATE orders SET fulfillment_meta_json=?,cancellation_window_minutes=? WHERE tenant=? AND id=?',[json_encode($fulfillmentMeta,JSON_THROW_ON_ERROR),$cancellation['enabled']?$cancellation['minutes']:0,$this->tenant,$id]);
   $this->execute('UPDATE orders SET tip=?,currency=?,payment_provider=?,address_json=?,customer_email=? WHERE tenant=? AND id=?',[$tip,$this->catalog['currency'],$paymentProvider,json_encode($canonical['addressDetails']??new \stdClass()),$contactEmail,$this->tenant,$id]);
   $this->execute('UPDATE orders SET plugin_data_json=? WHERE tenant=? AND id=?',[json_encode($canonical['pluginData']??new \stdClass()),$this->tenant,$id]);
   $this->execute('UPDATE orders SET order_location_json=? WHERE tenant=? AND id=?',[json_encode($orderLocation,JSON_THROW_ON_ERROR),$this->tenant,$id]);
   if(isset($canonical['customerId'])){
    if(!$this->query('SELECT 1 FROM customers WHERE tenant=? AND id=?',[$this->tenant,$canonical['customerId']]))throw new ApiError('Customer account not found.',401);
    $this->execute('UPDATE orders SET customer_id=? WHERE tenant=? AND id=?',[$canonical['customerId'],$this->tenant,$id]);
   }
   (new DeliveryAddresses($this))->ordered($this->get($id));
   if($total===0){$this->execute("UPDATE orders SET payment_status='paid' WHERE tenant=? AND id=?",[$this->tenant,$id]);$this->event($id,'no_payment_due','system');}
   $this->event($id,'placed','customer');return $this->receipt($this->get($id),$key);
  });
 }
 private function receipt(array $order,string $key):array{return ['id'=>$order['id'],'fulfillmentMeta'=>Fulfillment::read($order),'demo'=>true,'tip'=>(int)$order['tip'],'total'=>(int)$order['total'],'paymentProvider'=>$order['payment_provider'],'paymentMethod'=>self::paymentMethod($order['payment_provider']),'currency'=>$order['currency'],'trackingToken'=>hash_hmac('sha256',$order['id'].'|'.$key,$GLOBALS['dyws_config']['tracking_secret'])];}
 public function get(string $id):array{$rows=$this->query('SELECT * FROM orders WHERE tenant=? AND id=?',[$this->tenant,$id]);if(!$rows)throw new ApiError('Order not found.',404);return $rows[0];}
 public function event(string $id,string $status,string $actor):void{$this->execute('INSERT INTO events(tenant,order_id,status,actor,created_at) VALUES(?,?,?,?,?)',[$this->tenant,$id,$status,$actor,time()]);}
 public function change(string $id,string $status,string $actor,?string $driver=null,?string $startingRun=null):array{return $this->transaction(function()use($id,$status,$actor,$driver,$startingRun){
  $o=$this->get($id);$runs=new DeliveryRuns($this);if($driver!==null&&$o['driver_id']!==$driver)throw new ApiError('This delivery is not assigned to you.',403);$runs->guardChange($id,$status,$startingRun);
  if($status==='out_for_delivery'&&!$startingRun&&$runs->listing($o['driver_id']??''))throw new ApiError('Finish the assigned delivery run first.',409);
  if(!self::manualPayment($o['payment_provider'])&&$o['payment_status']==='unpaid'){
   $attempt=$this->query('SELECT status FROM payment_attempts WHERE tenant=? AND order_id=?',[$this->tenant,$id]);
   if($status!=='cancelled'||($attempt&&!in_array($attempt[0]['status'],['failed','expired'],true)))throw new ApiError('Wait for payment confirmation or checkout expiry before changing this order.',409);
  }
  $transitions=['placed'=>['accepted','cancelled'],'accepted'=>['preparing','cancelled'],'preparing'=>['ready','cancelled'],'ready'=>$o['fulfillment']==='pickup'?['completed','cancelled']:['out_for_delivery','cancelled'],'out_for_delivery'=>['delivered'],'delivered'=>[],'completed'=>[],'cancelled'=>[]];
  if($driver!==null && ($o['driver_id']!==$driver||!in_array($status,['out_for_delivery','delivered'],true)))throw new ApiError('This delivery is not assigned to you.',403);
  if(!in_array($status,$transitions[$o['status']]??[],true))throw new ApiError('This status change is not allowed.',409);
  if($status==='out_for_delivery'&&$o['driver_id'])CustomerDrivers::assertAllowed($this,$o,$o['driver_id']);
  if($status==='out_for_delivery'&&!$o['driver_id'])throw new ApiError('Assign a driver first.',409);
  if(in_array($status,['delivered','completed'],true)&&!in_array($o['payment_status'],['paid','partially_refunded'],true))throw new ApiError('Payment must be confirmed before completing the order.',409);
  $this->plugins?->validate('order.status_changing',$this->safeOrder($o),$status,$actor);
  $this->execute('UPDATE orders SET status=?,updated_at=? WHERE tenant=? AND id=?',[$status,time(),$this->tenant,$id]);
  if(in_array($status,['cancelled','delivered','completed'],true)){$this->execute('DELETE FROM locations WHERE tenant=? AND order_id=?',[$this->tenant,$id]);$this->execute('DELETE FROM location_shares WHERE tenant=? AND order_id=?',[$this->tenant,$id]);}
  if($status==='delivered')$runs->completed($id);
  $this->event($id,$status,$actor);return $this->safeOrder($this->get($id));
 });}
 public function assign(string $id,string $driver):void{$this->transaction(function()use($id,$driver){$o=$this->get($id);if((new DeliveryRuns($this))->membership($id))throw new ApiError('Cancel the planned run before reassigning this order.',409);if($o['fulfillment']!=='delivery'||in_array($o['status'],['out_for_delivery','delivered','completed','cancelled'],true))throw new ApiError('Driver assignment is not available for this order.',409);CustomerDrivers::assertAllowed($this,$o,$driver);$this->execute('UPDATE orders SET driver_id=?,updated_at=? WHERE tenant=? AND id=?',[$driver,time(),$this->tenant,$id]);$this->event($id,'driver_assigned','manager');});}
 public function payment(string $id,string $kind,string $actor='manager'):void{$this->transaction(function()use($id,$kind,$actor){$o=$this->get($id);if(!self::manualPayment($o['payment_provider']))throw new ApiError('Online payments are confirmed by the payment provider. Manage refunds with that provider.',409);if($kind==='capture'&&$o['payment_provider']==='pay-at-door'&&$o['status']!=='out_for_delivery')throw new ApiError('Record door payment during the assigned delivery.',409);if($kind==='capture'&&($o['payment_status']!=='unpaid'||$o['status']==='cancelled'))throw new ApiError('Payment cannot be recorded.',409);if($kind==='refund'&&$o['payment_status']!=='paid')throw new ApiError('Only a paid order can be refunded.',409);if(!in_array($kind,['capture','refund'],true))throw new ApiError('Unknown payment action.');$this->execute('INSERT INTO payments(tenant,order_id,kind,amount,created_at) VALUES(?,?,?,?,?)',[$this->tenant,$id,$kind,$o['total'],time()]);$this->execute('UPDATE orders SET payment_status=?,updated_at=? WHERE tenant=? AND id=?',[$kind==='capture'?'paid':'refunded',time(),$this->tenant,$id]);if($kind==='refund'&&$o['customer_cancelled_at']!==null)$this->execute("UPDATE orders SET cancellation_payment_state='refunded' WHERE tenant=? AND id=?",[$this->tenant,$id]);$this->event($id,($o['payment_provider']==='demo'?'test_payment_':'offline_payment_').$kind,$actor);});}
 public function collectDoorPayment(string $id,string $driver):void{$this->transaction(function()use($id,$driver){$o=$this->get($id);if($o['driver_id']!==$driver)throw new ApiError('This delivery is not assigned to you.',403);if($o['payment_provider']!=='pay-at-door'||$o['status']!=='out_for_delivery')throw new ApiError('Door payment is not available for this delivery.',409);$this->payment($id,'capture','driver:'.$driver);});}
 public function startLocation(string $id,array $session,string $source):array {
  if(!in_array($source,['device','simulated'],true))throw new ApiError('Choose a GPS source.');
  return $this->transaction(function()use($id,$session,$source){
   $o=$this->get($id);if($o['driver_id']!==$session['subject']||$o['status']!=='out_for_delivery')throw new ApiError('GPS requires your assigned active delivery.',403);
   $key=bin2hex(random_bytes(32));
   $this->execute('DELETE FROM locations WHERE tenant=? AND order_id=?',[$this->tenant,$id]);
   $this->execute('INSERT INTO location_shares(tenant,order_id,driver_id,sharing_hash,auth_hash,source,expires_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(tenant,order_id) DO UPDATE SET driver_id=excluded.driver_id,sharing_hash=excluded.sharing_hash,auth_hash=excluded.auth_hash,source=excluded.source,expires_at=excluded.expires_at',[$this->tenant,$id,$session['subject'],hash('sha256',$key),$session['token_hash'],$source,min(time()+120,$session['expires_at'])]);
   return ['sharingToken'=>$key,'expiresIn'=>120,'source'=>$source];
  });
 }
 public function stopLocation(string $id,array $session,string $key):void {
  $this->transaction(function()use($id,$session,$key){
   $share=$this->query('SELECT order_id FROM location_shares WHERE tenant=? AND order_id=? AND driver_id=? AND auth_hash=? AND sharing_hash=?',[$this->tenant,$id,$session['subject'],$session['token_hash'],hash('sha256',$key)]);
   // Idempotent and scoped to this sharing session, so an old tab cannot stop a new one.
   if($share){$this->execute('DELETE FROM locations WHERE tenant=? AND order_id=?',[$this->tenant,$id]);$this->execute('DELETE FROM location_shares WHERE tenant=? AND order_id=?',[$this->tenant,$id]);}
  });
 }
 public function testLocation(string $id,array $session,array $position):void {
  $share=$this->query('SELECT source,auth_hash FROM location_shares WHERE tenant=? AND order_id=?',[$this->tenant,$id])[0]??null;
  if(!$share||$share['source']!=='simulated'||$share['auth_hash']!==$session['token_hash'])$this->startLocation($id,$session,'simulated');
  $this->execute('UPDATE location_shares SET expires_at=? WHERE tenant=? AND order_id=?',[min(time()+120,$session['expires_at']),$this->tenant,$id]);
  $last=$this->query('SELECT recorded_at FROM locations WHERE tenant=? AND order_id=?',[$this->tenant,$id])[0]['recorded_at']??0;
  if($last<time())$this->locate($id,$session['subject'],['latitude'=>$position['latitude'],'longitude'=>$position['longitude'],'accuracy'=>$position['accuracy']??8,'recordedAt'=>time()]);
 }
 public function heartbeatLocation(string $id,array $session,string $key):void {
  $this->transaction(function()use($id,$session,$key){
   $o=$this->get($id);if($o['driver_id']!==$session['subject']||$o['status']!=='out_for_delivery')throw new ApiError('GPS requires your assigned active delivery.',403);
   $share=$this->query('SELECT order_id FROM location_shares WHERE tenant=? AND order_id=? AND driver_id=? AND auth_hash=? AND sharing_hash=? AND expires_at>?',[$this->tenant,$id,$session['subject'],$session['token_hash'],hash('sha256',$key),time()]);
   if(!$share)throw new ApiError('GPS connection expired. Reconnecting.',403);
   $this->execute('UPDATE location_shares SET expires_at=? WHERE tenant=? AND order_id=?',[min(time()+120,$session['expires_at']),$this->tenant,$id]);
  });
 }
 public function pruneLocations():array {
  return $this->transaction(function(){
   $invalid="SELECT ls.order_id FROM location_shares ls LEFT JOIN sessions s ON s.token_hash=ls.auth_hash AND s.tenant=ls.tenant AND s.role='driver' AND s.subject=ls.driver_id LEFT JOIN orders o ON o.tenant=ls.tenant AND o.id=ls.order_id WHERE ls.tenant=? AND (ls.expires_at<=? OR s.token_hash IS NULL OR s.expires_at<=? OR o.status<>'out_for_delivery' OR o.driver_id<>ls.driver_id)";
   $ids=array_column($this->query($invalid,[$this->tenant,time(),time()]),'order_id');
   $this->execute('DELETE FROM locations WHERE tenant=? AND (recorded_at<=? OR order_id IN ('.$invalid.'))',[$this->tenant,time()-900,$this->tenant,time(),time()]);
   $this->execute('DELETE FROM location_shares WHERE tenant=? AND order_id IN ('.$invalid.')',[$this->tenant,$this->tenant,time(),time()]);
   return $ids;
  });
 }
 public function locate(string $id,string $driver,array $b,?array $session=null):void {
  $this->transaction(function()use($id,$driver,$b,$session){
   $o=$this->get($id);if($o['driver_id']!==$driver||$o['status']!=='out_for_delivery')throw new ApiError('Location sharing is only available for your active delivery.',403);
   // HTTP callers must present the short lived sharing token as well as their login.
   if($session!==null){
    $key=self::text($b['sharingToken']??null,64);
    $share=$this->query('SELECT * FROM location_shares WHERE tenant=? AND order_id=? AND driver_id=? AND auth_hash=? AND sharing_hash=? AND expires_at>?',[$this->tenant,$id,$driver,$session['token_hash'],hash('sha256',$key),time()]);
    if(!$share)throw new ApiError('GPS sharing ended. Start sharing again for this delivery.',403);
    $auth=$this->query("SELECT token_hash FROM sessions WHERE tenant=? AND token_hash=? AND role='driver' AND subject=? AND expires_at>?",[$this->tenant,$session['token_hash'],$driver,time()]);
    if(!$auth)throw new ApiError('Your session expired. Sign in again.',401);
   }
   $lat=$b['latitude']??null;$lon=$b['longitude']??null;$accuracy=$b['accuracy']??null;$at=$b['recordedAt']??null;
   foreach([$lat,$lon,$accuracy] as $v)if((!is_int($v)&&!is_float($v))||!is_finite((float)$v))throw new ApiError('GPS coordinates and accuracy must be finite numbers.');
   if(!is_int($at)||$lat< -90||$lat>90||$lon< -180||$lon>180||$accuracy<0||$accuracy>5000||$at<time()-180||$at>time()+30)throw new ApiError('Invalid or outdated GPS update.');
   $previous=$this->query('SELECT recorded_at FROM locations WHERE tenant=? AND order_id=?',[$this->tenant,$id]);
   if($previous&&$previous[0]['recorded_at']>=$at)throw new ApiError('GPS update is older than the latest position.',409);
   $this->execute('INSERT INTO locations(tenant,order_id,driver_id,latitude,longitude,accuracy,recorded_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(tenant,order_id) DO UPDATE SET driver_id=excluded.driver_id,latitude=excluded.latitude,longitude=excluded.longitude,accuracy=excluded.accuracy,recorded_at=excluded.recorded_at',[$this->tenant,$id,$driver,$lat,$lon,$accuracy,$at]);
   if($session!==null)$this->execute('UPDATE location_shares SET expires_at=? WHERE tenant=? AND order_id=?',[min(time()+120,$session['expires_at']),$this->tenant,$id]);
  });
 }
 public function locationSummary(string $id):array {
  $rows=$this->query('SELECT s.source,l.recorded_at,l.accuracy,l.latitude,l.longitude FROM location_shares s LEFT JOIN locations l ON l.tenant=s.tenant AND l.order_id=s.order_id WHERE s.tenant=? AND s.order_id=?',[$this->tenant,$id]);$row=$rows[0]??null;
  return ['sharing'=>$row!==null,'source'=>$row['source']??null,'recordedAt'=>isset($row['recorded_at'])?(int)$row['recorded_at']:null,'accuracy'=>$row['accuracy']??null,'location'=>isset($row['recorded_at'])?['latitude'=>(float)$row['latitude'],'longitude'=>(float)$row['longitude'],'accuracy'=>(float)$row['accuracy'],'recorded_at'=>(int)$row['recorded_at']]:null,'stale'=>!isset($row['recorded_at'])||time()-(int)$row['recorded_at']>60];
 }
 public function orderLocation(array $order):array {
  $saved=json_decode($order['order_location_json']??'{}',true);
  return $saved?:['id'=>'','name'=>$this->catalog['businessName']??$this->catalog['restaurant']??'','address'=>$this->catalog['pickupAddress']??'','phone'=>$this->catalog['businessPhone']??''];
 }
 private function trackingDriver(array $order):?array {
  if($order['fulfillment']!=='delivery'||!$order['driver_id']||$order['status']==='cancelled')return null;
  if(!$this->query("SELECT 1 FROM sqlite_master WHERE type='table' AND name='drivers'"))return null;
  return $this->query('SELECT name,vehicle_type AS vehicleType,vehicle_color AS vehicleColor,profile_icon AS profileIcon FROM drivers WHERE tenant=? AND id=?',[$this->tenant,$order['driver_id']])[0]??null;
 }
 public function tracking(string $id,string $token):array{$rows=$this->query('SELECT * FROM orders WHERE tenant=? AND id=? AND tracking_hash=? AND tracking_expires>?',[$this->tenant,$id,hash('sha256',$token),time()]);if(!$rows)throw new ApiError('Tracking link is unavailable or expired.',404);$o=$rows[0];$location=null;if($o['status']==='out_for_delivery'){$locations=$this->query('SELECT latitude,longitude,accuracy,recorded_at FROM locations WHERE tenant=? AND order_id=? AND recorded_at>?',[$this->tenant,$id,time()-900]);$location=$locations[0]??null;}
 $summary=['discount'=>(int)$o['discount'],'deal'=>array_intersect_key(json_decode($o['deal_json'],true),array_flip(['id','name','rule'])),'grossSubtotal'=>(int)$o['subtotal']+(int)$o['discount'],'lines'=>array_map(static fn($line)=>array_intersect_key($line,array_flip(['name','option','quantity','price'])),json_decode($o['lines_json'],true)),'currency'=>$o['currency'],'subtotal'=>(int)$o['subtotal'],'tax'=>(int)$o['tax'],'deliveryFee'=>(int)$o['delivery_fee'],'tip'=>(int)$o['tip'],'total'=>(int)$o['total']];
 return ['id'=>$id,'cancellation'=>Cancellation::summary($o),'demo'=>true,'status'=>$o['status'],'paymentStatus'=>$o['payment_status'],'paymentProvider'=>$o['payment_provider'],'paymentMethod'=>self::paymentMethod($o['payment_provider']),'checkoutStatus'=>$this->query('SELECT status FROM payment_attempts WHERE tenant=? AND order_id=?',[$this->tenant,$id])[0]['status']??null,'fulfillment'=>$o['fulfillment'],'fulfillmentMeta'=>Fulfillment::read($o),'summary'=>$summary,'orderLocation'=>$this->orderLocation($o),'business'=>['name'=>$this->catalog['businessName'],'phone'=>$this->orderLocation($o)['phone']?:($this->catalog['businessPhone']??''),'pickupAddress'=>$this->orderLocation($o)['address']],'createdAt'=>(int)$o['created_at'],'driver'=>$this->trackingDriver($o),'deliveryAddress'=>$o['address'],'updatedAt'=>(int)$o['updated_at'],'events'=>$this->query('SELECT status,created_at FROM events WHERE tenant=? AND order_id=? ORDER BY id',[$this->tenant,$id]),'location'=>$location,'locationSource'=>$this->locationSummary($id)['source'],'deliveryRun'=>(new DeliveryRuns($this))->progress($id),'gpsStale'=>$location?time()-(int)$location['recorded_at']>60:true];}
 public function safeOrder(array $o):array{$o['deal']=json_decode($o['deal_json'],true);unset($o['deal_json']);$o['cancellation']=Cancellation::summary($o);unset($o['cancellation']['serverTime']);unset($o['cancellation_window_minutes'],$o['customer_cancelled_at'],$o['cancellation_payment_state']);$o['fulfillmentMeta']=Fulfillment::read($o);unset($o['fulfillment_meta_json']);$o['orderLocation']=$this->orderLocation($o);unset($o['order_location_json']);$o['pluginData']=json_decode($o['plugin_data_json']??'{}',true);unset($o['plugin_data_json']);$o['addressDetails']=json_decode($o['address_json']??'{}',true);unset($o['address_json']);$o['gps']=$this->locationSummary($o['id']);$o['deliveryRun']=(new DeliveryRuns($this))->membership($o['id']);unset($o['customer_email'],$o['customer_id'],$o['delivery_address_id'],$o['request_key'],$o['fingerprint'],$o['tracking_hash'],$o['tracking_expires']);$o['lines']=json_decode($o['lines_json'],true);unset($o['lines_json']);return $o;}
 public function orders(?string $driver=null):array{$args=[$this->tenant];$sql='SELECT * FROM orders WHERE tenant=?';if($driver!==null){$sql.=' AND driver_id=? AND status IN (\'ready\',\'out_for_delivery\')';$args[]=$driver;}$sql.=" ORDER BY CASE WHEN status IN ('completed','delivered','cancelled') THEN 1 ELSE 0 END, CASE WHEN status IN ('completed','delivered','cancelled') THEN -created_at ELSE COALESCE(CAST(json_extract(fulfillment_meta_json,'$.scheduledAt') AS INTEGER)-1800,created_at) END, id LIMIT 200";return array_map(fn($o)=>$this->safeOrder($o),$this->query($sql,$args));}
 public function driverTips(string $driver,?int $now=null):array{return DriverTips::summary($this,$driver,$this->timeZone,$now);}
 public function reports(int $from,int $to):array{
  $o=$this->query('SELECT count(*) AS orderCount,coalesce(sum(total),0) AS orderedValue,coalesce(sum(tip),0) AS orderedTips,coalesce(sum(CASE WHEN status NOT IN (\'completed\',\'delivered\',\'cancelled\') THEN 1 ELSE 0 END),0) AS activeOrders,coalesce(sum(CASE WHEN status=\'cancelled\' THEN 1 ELSE 0 END),0) AS cancelledOrders FROM orders WHERE tenant=? AND created_at>=? AND created_at<?',[$this->tenant,$from,$to])[0];
  $ledger=$this->query('SELECT p.kind,p.amount,o.subtotal,o.tax,o.delivery_fee,o.tip FROM payments p JOIN orders o ON p.order_id=o.id AND p.tenant=o.tenant WHERE p.tenant=? AND p.created_at>=? AND p.created_at<? AND NOT (p.kind=\'refund\' AND EXISTS (SELECT 1 FROM payment_refund_deltas d WHERE d.tenant=p.tenant AND d.order_id=p.order_id))',[$this->tenant,$from,$to]);
  $ledger=array_merge($ledger,$this->query("SELECT 'refund' AS kind,p.amount,p.subtotal,p.tax,p.delivery_fee,p.tip FROM payment_refund_deltas p JOIN orders o ON p.order_id=o.id AND p.tenant=o.tenant WHERE p.tenant=? AND p.created_at>=? AND p.created_at<?",[$this->tenant,$from,$to]));$o+=['captured'=>0,'refunded'=>0,'netCollected'=>0,'netSales'=>0,'netTax'=>0,'netDeliveryFees'=>0,'capturedTips'=>0,'refundedTips'=>0,'netTips'=>0];foreach($ledger as $p){$sign=$p['kind']==='capture'?1:-1;$o[$p['kind']==='capture'?'captured':'refunded']+=(int)$p['amount'];$o['netCollected']+=$sign*(int)$p['amount'];$parts=Tips::allocate($p,(int)$p['amount']);$o['netSales']+=$sign*$parts['subtotal'];$o['netDeliveryFees']+=$sign*$parts['delivery_fee'];$o['netTax']+=$sign*$parts['tax'];$o[$p['kind']==='capture'?'capturedTips':'refundedTips']+=$parts['tip'];$o['netTips']+=$sign*$parts['tip'];}
  $o['averageOrderValue']=$o['orderCount']?(int)round($o['orderedValue']/$o['orderCount']):0;
  $o['byStatus']=$this->query('SELECT status,count(*) AS count FROM orders WHERE tenant=? AND created_at>=? AND created_at<? GROUP BY status',[$this->tenant,$from,$to]);
  $items=[];foreach($this->query('SELECT lines_json FROM orders WHERE tenant=? AND created_at>=? AND created_at<? AND status<>\'cancelled\'',[$this->tenant,$from,$to])as $r)foreach(json_decode($r['lines_json'],true)as $l){$k=$l['id'].':'.$l['variant'];if(!isset($items[$k]))$items[$k]=['name'=>$l['name'],'option'=>$l['option'],'quantity'=>0,'orderedSubtotal'=>0];$items[$k]['quantity']+=$l['quantity'];$items[$k]['orderedSubtotal']+=($l['quantity']*$l['price']-($l['discount']??0));}usort($items,fn($a,$b)=>$b['quantity']<=>$a['quantity']);$o['topItems']=array_slice($items,0,10);
  $o['byFulfillment']=$this->query('SELECT fulfillment,count(*) AS count FROM orders WHERE tenant=? AND created_at>=? AND created_at<? GROUP BY fulfillment',[$this->tenant,$from,$to]);
  $o['averagePreparationSeconds']=null;$o['averageDeliverySeconds']=null;
  foreach(['averagePreparationSeconds'=>['accepted','ready'],'averageDeliverySeconds'=>['out_for_delivery','delivered']] as $metric=>$pair){$rows=$this->query('SELECT avg(e2.created_at-e1.created_at) AS duration FROM events e1 JOIN events e2 ON e1.order_id=e2.order_id AND e1.tenant=e2.tenant JOIN orders ord ON ord.id=e1.order_id AND ord.tenant=e1.tenant WHERE e1.tenant=? AND e1.status=? AND e2.status=? AND ord.created_at>=? AND ord.created_at<?',[$this->tenant,$pair[0],$pair[1],$from,$to]);if($rows[0]['duration']!==null)$o[$metric]=(int)round($rows[0]['duration']);}
  $o['from']=$from;$o['to']=$to;$o['currency']=$this->catalog['currency'];$o['demo']=true;return $o;
 }
}
