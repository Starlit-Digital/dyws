<?php
declare(strict_types=1);
namespace dyws\Plugins\Stripe;
use dyws\{Store,Catalog,ApiError};

final class StripePayments {
 public function __construct(private Store $store,private array $config,private StripeSettings $settings,private $createSession=null){}
 private function sdk():void {if(!class_exists(\Stripe\StripeClient::class))throw new ApiError('Load the Composer autoloader before using Stripe.',503);}
 private function client():\Stripe\StripeClient {
  $this->sdk();$s=$this->settings->read();if(!$s['apiKey'])throw new ApiError('Stripe has not been configured.',503);
  return new \Stripe\StripeClient(['api_key'=>$s['apiKey'],'max_network_retries'=>2]);
 }
 public function verifyConnection():array {
  try{$this->client()->checkout->sessions->all(['limit'=>1]);return ['ok'=>true,'mode'=>'test'];}
  catch(\Stripe\Exception\ApiErrorException $e){throw new ApiError('Stripe could not verify this key. Check its sandbox and Checkout Sessions permissions.',422);}
 }
 public function checkout(string $id,string $trackingToken):array {
  $this->store->tracking($id,$trackingToken);
  $attempt=$this->store->transaction(function()use($id){
   $o=$this->store->get($id);if($o['payment_provider']!=='stripe'||$o['payment_status']!=='unpaid'||$o['status']!=='placed')throw new ApiError('Checkout is not available for this order.',409);
   $existing=$this->store->query('SELECT * FROM payment_attempts WHERE tenant=? AND order_id=?',[$this->store->tenant,$id]);
   if($existing)return $existing[0];
   if(!$this->settings->read()['enabled'])throw new ApiError('Stripe checkout is currently disabled.',503);
   if($o['total']<100)throw new ApiError('Stripe test orders must total at least $1.00.');
   $nonce=bin2hex(random_bytes(16));$this->store->execute('INSERT INTO payment_attempts(tenant,order_id,nonce,status,amount,currency,created_at) VALUES(?,?,?,\'creating\',?,?,?)',[$this->store->tenant,$id,$nonce,$o['total'],$o['currency'],time()]);
   return $this->store->query('SELECT * FROM payment_attempts WHERE tenant=? AND order_id=?',[$this->store->tenant,$id])[0];
  });
  if(!in_array($attempt['status'],['creating','open'],true))throw new ApiError('This payment is pending or closed. Check the order status before placing another order.',409);
  if($attempt['checkout_url'])return ['url'=>$attempt['checkout_url']];
  // Stripe retains idempotency keys for at least 24 hours. Never recreate after that boundary.
  if($attempt['created_at']<time()-82800)throw new ApiError('This checkout attempt is too old. Contact the administrator.',409);
  $params=$this->parameters($this->store->get($id),$attempt);
  try{$session=$this->createSession?($this->createSession)($params,'checkout-'.$attempt['nonce']):$this->client()->checkout->sessions->create($params,['idempotency_key'=>'checkout-'.$attempt['nonce']])->toArray();}
  catch(\Stripe\Exception\ApiErrorException $e){throw new ApiError('Stripe checkout is unavailable. Your order is saved. Check payment settings or retry.',502);}
  if(!is_string($session['id']??null)||!is_string($session['url']??null)||!str_starts_with($session['url'],'https://checkout.stripe.com/'))throw new ApiError('Stripe did not return a valid checkout link.',502);
  $this->store->execute("UPDATE payment_attempts SET session_id=coalesce(session_id,?),checkout_url=?,status=CASE WHEN status='creating' THEN 'open' ELSE status END WHERE tenant=? AND order_id=?",[$session['id'],$session['url'],$this->store->tenant,$id]);
  return ['url'=>$session['url']];
 }
 public function parameters(array $order,array $attempt):array {
  $base=rtrim($this->config['public_base_url']??'','/');if(!preg_match('~^https://[^?#]+$~',$base)&&!preg_match('~^http://127\.0\.0\.1:\d+$~',$base))throw new ApiError('The public checkout URL is not configured.',503);
  $meta=['order_id'=>$order['id'],'tenant'=>$this->store->tenant,'attempt'=>$attempt['nonce']];
  $items=[];foreach(json_decode($order['lines_json'],true) as $line)$items[]=['quantity'=>$line['quantity'],'price_data'=>['currency'=>strtolower($order['currency']),'unit_amount'=>$line['price'],'product_data'=>['name'=>trim($line['name'].' '.$line['option'])]]];
  foreach(['delivery_fee'=>'Delivery','tax'=>'Configured tax'] as $field=>$name)if($order[$field]>0)$items[]=['quantity'=>1,'price_data'=>['currency'=>strtolower($order['currency']),'unit_amount'=>$order[$field],'product_data'=>['name'=>$name]]];
  $suffix='';foreach(str_split(substr($attempt['nonce'],0,8)) as $c)$suffix.=chr(97+hexdec($c));
  return ['mode'=>'payment','adaptive_pricing'=>['enabled'=>false],'client_reference_id'=>$order['id'],'metadata'=>$meta,'payment_intent_data'=>['metadata'=>$meta],'line_items'=>$items,'success_url'=>$base.'/?payment=returned#customer-tracking','cancel_url'=>$base.'/?payment=cancelled#customer-tracking','integration_identifier'=>'dyws_'.$suffix];
 }
 public function webhook(string $raw,string $signature):array {
  $this->sdk();$secret=$this->settings->read()['webhookSecret'];if(!$secret)throw new ApiError('Webhook is not configured.',503);
  try{$event=\Stripe\Webhook::constructEvent($raw,$signature,$secret,300)->toArray();}
  catch(\UnexpectedValueException|\Stripe\Exception\SignatureVerificationException $e){throw new ApiError('Invalid Stripe signature.',400);}
  return $this->process($event);
 }
 public function process(array $event):array {
  if(($event['livemode']??true)!==false)throw new ApiError('Live Stripe events are not enabled.',400);
  $type=$event['type']??'';
  if(!in_array($type,['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','checkout.session.expired','charge.refunded'],true))return ['received'=>true];
  $eventId=Store::text($event['id']??null,255);$obj=$event['data']['object']??[];
  return $this->store->transaction(function()use($eventId,$type,$obj){
   $tenant=$this->store->tenant;if($this->store->query('SELECT 1 FROM payment_events WHERE tenant=? AND event_id=?',[$tenant,$eventId]))return ['received'=>true];
   if($type==='charge.refunded'){
    $attempt=$this->store->query('SELECT * FROM payment_attempts WHERE tenant=? AND payment_intent=?',[$tenant,$obj['payment_intent']??'']);
    if(!$attempt)throw new ApiError('Payment has not been reconciled yet.',409);$attempt=$attempt[0];$o=$this->store->get($attempt['order_id']);
    if($o['payment_status']==='unpaid')throw new ApiError('Payment has not been reconciled yet.',409);
    if(($obj['currency']??'')!==strtolower($o['currency'])||($obj['amount']??-1)!==$o['total']||!is_int($obj['amount_refunded']??null)||$obj['amount_refunded']<0||$obj['amount_refunded']>$o['total'])throw new ApiError('Refund does not match the order.',409);
    $previous=$this->store->query("SELECT amount FROM payments WHERE tenant=? AND order_id=? AND kind='refund'",[$tenant,$o['id']]);$amount=$obj['amount_refunded'];
    if($amount>($previous[0]['amount']??0)){
     $before=$previous[0]['amount']??0;$delta=$amount-$before;
     $sales=(int)round($o['subtotal']*$amount/$o['total'])-(int)round($o['subtotal']*$before/$o['total']);
     $fee=(int)round($o['delivery_fee']*$amount/$o['total'])-(int)round($o['delivery_fee']*$before/$o['total']);
     $this->store->execute('INSERT INTO payment_refund_deltas(tenant,event_id,order_id,amount,subtotal,tax,delivery_fee,created_at) VALUES(?,?,?,?,?,?,?,?)',[$tenant,$eventId,$o['id'],$delta,$sales,$delta-$sales-$fee,$fee,time()]);
     $this->store->execute("INSERT INTO payments(tenant,order_id,kind,amount,created_at) VALUES(?,?,'refund',?,?) ON CONFLICT(tenant,order_id,kind) DO UPDATE SET amount=excluded.amount,created_at=excluded.created_at",[$tenant,$o['id'],$amount,time()]);
     $this->store->execute('UPDATE orders SET payment_status=?,updated_at=? WHERE tenant=? AND id=?',[$amount===$o['total']?'refunded':'partially_refunded',time(),$tenant,$o['id']]);$this->store->event($o['id'],'stripe_test_refund','stripe');
    }
   }else{
    $meta=$obj['metadata']??[];
    if(($meta['tenant']??'')!==$tenant)throw new ApiError('Payment belongs to another business.',400);
    $o=$this->store->get(Store::text($meta['order_id']??null,30));
    $attempt=$this->store->query('SELECT * FROM payment_attempts WHERE tenant=? AND order_id=?',[$tenant,$o['id']]);
    if(!$attempt)throw new ApiError('No matching checkout attempt.',409);$attempt=$attempt[0];
    if($o['payment_provider']!=='stripe'||!hash_equals($attempt['nonce'],(string)($meta['attempt']??''))||($attempt['session_id']!==null&&$attempt['session_id']!==($obj['id']??''))||($obj['client_reference_id']??'')!==$o['id']||($obj['amount_total']??-1)!==$o['total']||($obj['currency']??'')!==strtolower($o['currency']))throw new ApiError('Payment does not match the order.',409);
    if(!is_string($obj['id']??null)||!str_starts_with($obj['id'],'cs_'))throw new ApiError('Invalid session.',400);
    $paid=in_array($type,['checkout.session.completed','checkout.session.async_payment_succeeded'],true)&&($obj['payment_status']??'')==='paid';
    $state=$paid?'paid':match($type){'checkout.session.expired'=>'expired','checkout.session.async_payment_failed'=>'failed',default=>'pending'};
    if($paid&&$o['payment_status']==='unpaid'){
     $this->store->execute("INSERT INTO payments(tenant,order_id,kind,amount,created_at) VALUES(?,?,'capture',?,?)",[$tenant,$o['id'],$o['total'],time()]);
     $this->store->execute("UPDATE orders SET payment_status='paid',updated_at=? WHERE tenant=? AND id=?",[time(),$tenant,$o['id']]);$this->store->event($o['id'],'stripe_test_payment','stripe');
    }
    // Older pending/failure events must never downgrade a paid session.
    $this->store->execute("UPDATE payment_attempts SET session_id=coalesce(session_id,?),payment_intent=coalesce(payment_intent,?),status=CASE WHEN status='paid' THEN status WHEN ?='paid' THEN 'paid' WHEN status IN ('failed','expired') THEN status ELSE ? END WHERE tenant=? AND order_id=?",[$obj['id'],is_string($obj['payment_intent']??null)?$obj['payment_intent']:null,$state,$state,$tenant,$o['id']]);
   }
   $this->store->execute('INSERT INTO payment_events(tenant,event_id,created_at) VALUES(?,?,?)',[$tenant,$eventId,time()]);return ['received'=>true];
  });
 }
}
