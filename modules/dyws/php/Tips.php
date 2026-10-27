<?php
declare(strict_types=1);
namespace dyws;

/** All amounts are integer cents. Tip input is voluntary and never part of the tax base. */
final class Tips {
 public const MAX=99999900;
 public static function validate(mixed $tip):int {
  if(!is_int($tip)||$tip<0||$tip>self::MAX||$tip%100!==0)throw new ApiError('Enter a tip in whole dollars, from 0 to 999999.');
  return $tip;
 }
 /** Split a cumulative payment or refund. Each component grows monotonically,
  * so successive refund deltas reconcile exactly, including a final full refund. */
 public static function allocate(array $order,int $amount):array {
  // Preserve allocation for existing orders that predate tips.
  if(empty($order['tip'])){$total=(int)$order['subtotal']+(int)$order['tax']+(int)$order['delivery_fee'];$sales=$total?(int)round($amount*(int)$order['subtotal']/$total):0;$fee=$total?(int)round($amount*(int)$order['delivery_fee']/$total):0;return ['tip'=>0,'subtotal'=>$sales,'delivery_fee'=>$fee,'tax'=>$amount-$sales-$fee];}
  $parts=[];$remaining=$amount;
  $base=(int)$order['subtotal']+(int)$order['tax']+(int)$order['delivery_fee']+(int)($order['tip']??0);
  foreach(['tip','delivery_fee','subtotal','tax'] as $key){
   $value=(int)($order[$key]??0);
   $parts[$key]=$base>0?(int)round($remaining*$value/$base):0;
   $remaining-=$parts[$key];$base-=$value;
  }
  return $parts;
 }
}
