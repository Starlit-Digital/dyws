<?php
declare(strict_types=1);
namespace dyws;

/** The location policy is copied onto each order when it is placed. */
final class Cancellation {
 public static function policy($value):array {
  if($value===null)return ['enabled'=>false,'minutes'=>4];
  if(!is_array($value)||!is_bool($value['enabled']??null)||!is_int($value['minutes']??null)||$value['minutes']<1||$value['minutes']>1440)throw new ApiError('Cancellation window must be a whole number from 1 to 1440 minutes.');
  return ['enabled'=>$value['enabled'],'minutes'=>$value['minutes']];
 }
 public static function summary(array $order,?int $now=null):array {
  $now??=time();$minutes=(int)($order['cancellation_window_minutes']??0);
  $deadline=$minutes?(int)$order['created_at']+$minutes*60:null;
  return ['enabled'=>$minutes>0,'minutes'=>$minutes,'deadline'=>$deadline,'serverTime'=>$now,
   'available'=>$minutes>0&&$now<$deadline&&in_array($order['status'],['placed','accepted','preparing','ready'],true),
   'cancelledAt'=>isset($order['customer_cancelled_at'])?(int)$order['customer_cancelled_at']:null,
   'paymentState'=>$order['cancellation_payment_state']??'', 'refundAmount'=>(int)$order['total'],'fee'=>0];
 }
 public static function cancel(Store $store,string $id,string $token,?bool &$changed=null):array {
  $changed=false;$store->transaction(function()use($store,$id,$token,&$changed){
   $store->tracking($id,$token);$order=$store->get($id);
   if($order['customer_cancelled_at']!==null)return;
   if(!self::summary($order)['available'])throw new ApiError('The cancellation window has closed or this order has already left the store.',409);
   if($order['payment_provider']!=='demo'&&!$store->plugins?->supportsPaymentCancellation($order['payment_provider']))throw new ApiError('Automatic cancellation is temporarily unavailable. Contact the store.',503);
   $store->plugins?->validate('order.status_changing',$store->safeOrder($order),'cancelled','customer');
   (new DeliveryRuns($store))->removeCancelledOrder($id);
   $now=time();$store->execute("UPDATE orders SET status='cancelled',customer_cancelled_at=?,updated_at=?,cancellation_payment_state='pending' WHERE tenant=? AND id=?",[$now,$now,$store->tenant,$id]);
   foreach(['locations','location_shares'] as $table)$store->execute("DELETE FROM $table WHERE tenant=? AND order_id=?",[$store->tenant,$id]);
   $store->event($id,'cancelled','customer');$changed=true;
   if($order['payment_provider']==='demo'){
    if($order['payment_status']==='paid')$store->payment($id,'refund','customer');
    $state=$store->get($id)['payment_status']==='refunded'?'refunded':'not_charged';
    $store->execute('UPDATE orders SET cancellation_payment_state=? WHERE tenant=? AND id=?',[$state,$store->tenant,$id]);
   }else $store->execute('INSERT INTO cancellation_jobs(tenant,order_id,next_attempt) VALUES(?,?,0)',[$store->tenant,$id]);
  });
  self::settle($store,$id);
  return $store->tracking($id,$token);
 }
 /** Durable work is claimed briefly; provider calls never hold a database lock. */
 public static function settle(Store $store,string $id):bool {
  $lease=bin2hex(random_bytes(16));
  $claimed=$store->transaction(function()use($store,$id,$lease){
   $job=$store->query('SELECT * FROM cancellation_jobs WHERE tenant=? AND order_id=? AND next_attempt<=? AND lease_until<=?',[$store->tenant,$id,time(),time()])[0]??null;
   if(!$job)return false;
   $store->execute('UPDATE cancellation_jobs SET lease=?,lease_until=?,attempts=attempts+1 WHERE tenant=? AND order_id=?',[$lease,time()+180,$store->tenant,$id]);return true;
  });
  if(!$claimed)return false;
  try{
   $order=$store->get($id);
   $state=$order['payment_status']==='refunded'?'refunded':$store->plugins?->cancelPayment($order['payment_provider'],$id);
   if(!in_array($state,['refunded','not_charged','pending','refund_pending','attention'],true))throw new \RuntimeException('Invalid cancellation result.');
   // Only the provider's verified ledger can confirm a completed refund.
   if($state==='refunded'&&$store->get($id)['payment_status']!=='refunded')throw new \RuntimeException('Unconfirmed refund.');
  }catch(\Throwable $error){error_log('dyws cancellation '.$id.': '.$error->getMessage());$state='attention';}
  return $store->transaction(function()use($store,$id,$lease,$state){
   if(!$store->query('SELECT 1 FROM cancellation_jobs WHERE tenant=? AND order_id=? AND lease=?',[$store->tenant,$id,$lease]))return false;
   $order=$store->get($id);if($order['payment_status']==='refunded')$state='refunded';
   $changed=$order['cancellation_payment_state']!==$state;
   $store->execute('UPDATE orders SET cancellation_payment_state=?,updated_at=? WHERE tenant=? AND id=?',[$state,time(),$store->tenant,$id]);
   if(in_array($state,['refunded','not_charged'],true))$store->execute('DELETE FROM cancellation_jobs WHERE tenant=? AND order_id=?',[$store->tenant,$id]);
   else $store->execute("UPDATE cancellation_jobs SET lease='',lease_until=0,next_attempt=? WHERE tenant=? AND order_id=?",[time()+($state==='attention'?60:30),$store->tenant,$id]);
   if($changed)$store->event($id,'cancellation_payment_'.$state,'payment');return $changed;
  });
 }
 public static function drain(Store $store,int $limit=10):array {
  $changed=[];
  foreach($store->query('SELECT order_id FROM cancellation_jobs WHERE tenant=? AND next_attempt<=? AND lease_until<=? ORDER BY next_attempt LIMIT ?',[$store->tenant,time(),time(),$limit]) as $job)if(self::settle($store,$job['order_id']))$changed[]=$job['order_id'];
  return $changed;
 }
}
