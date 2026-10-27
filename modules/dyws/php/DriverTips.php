<?php
declare(strict_types=1);
namespace dyws;

/** Earnings are completed, paid deliveries, attributed to their completion day.
 * Later refunds restate that day's retained tip. No payout is implied. */
final class DriverTips {
 public static function summary(Store $store,string $driver,string $timeZone,?int $now=null):array {
  $zone=new \DateTimeZone($timeZone);$today=(new \DateTimeImmutable('@'.($now??time())))->setTimezone($zone)->setTime(0,0);
  $starts=['today'=>$today->getTimestamp(),'week'=>$today->modify('monday this week')->getTimestamp(),'month'=>$today->modify('first day of this month')->getTimestamp(),'year'=>$today->setDate((int)$today->format('Y'),1,1)->getTimestamp(),'allTime'=>0];
  $rows=$store->query("SELECT o.id,o.currency,o.tip,o.subtotal,o.tax,o.delivery_fee,
   coalesce((SELECT min(e.created_at) FROM events e WHERE e.tenant=o.tenant AND e.order_id=o.id AND e.status='delivered'),o.updated_at) AS earned_at,
   coalesce((SELECT sum(d.tip) FROM payment_refund_deltas d WHERE d.tenant=o.tenant AND d.order_id=o.id),-1) AS refunded_tip,
   coalesce((SELECT p.amount FROM payments p WHERE p.tenant=o.tenant AND p.order_id=o.id AND p.kind='refund'),0) AS refunded_amount
   FROM orders o WHERE o.tenant=? AND o.driver_id=? AND o.status='delivered' AND o.fulfillment='delivery' AND o.tip>0
   AND EXISTS(SELECT 1 FROM payments p WHERE p.tenant=o.tenant AND p.order_id=o.id AND p.kind='capture') ORDER BY earned_at DESC,o.id",[$store->tenant,$driver]);
  $currencies=[];$history=[];
  $empty=['gross'=>0,'refunded'=>0,'net'=>0,'orders'=>0];
  foreach($rows as $row){
   $currency=$row['currency'];$earned=(int)$row['earned_at'];if($earned>($now??time()))continue;
   $gross=(int)$row['tip'];$refund=(int)$row['refunded_tip'];if($refund<0)$refund=Tips::allocate($row,(int)$row['refunded_amount'])['tip'];
   $refund=min($gross,$refund);$net=$gross-$refund;
   if(!isset($currencies[$currency]))$currencies[$currency]=['currency'=>$currency,'periods'=>array_fill_keys(array_keys($starts),$empty),'daily'=>[],'weekly'=>[],'monthly'=>[]];
   $bucket=&$currencies[$currency];
   foreach($starts as $period=>$start)if($earned>=$start){$bucket['periods'][$period]['gross']+=$gross;$bucket['periods'][$period]['refunded']+=$refund;$bucket['periods'][$period]['net']+=$net;$bucket['periods'][$period]['orders']++;}
   $date=(new \DateTimeImmutable('@'.$earned))->setTimezone($zone);
   foreach(['daily'=>$date->format('Y-m-d'),'weekly'=>$date->modify('monday this week')->format('Y-m-d'),'monthly'=>$date->format('Y-m')] as $period=>$key){
    if(!isset($bucket[$period][$key]))$bucket[$period][$key]=['date'=>$key]+$empty;
    $bucket[$period][$key]['gross']+=$gross;$bucket[$period][$key]['refunded']+=$refund;$bucket[$period][$key]['net']+=$net;$bucket[$period][$key]['orders']++;
   }
   unset($bucket);
   if(count($history)<50)$history[]=['id'=>$row['id'],'currency'=>$currency,'earnedAt'=>$earned,'tip'=>$gross,'refundedTip'=>$refund,'netTip'=>$net];
  }
  foreach($currencies as &$bucket)foreach(['daily','weekly','monthly'] as $period)$bucket[$period]=array_values($bucket[$period]);unset($bucket);
  return ['timeZone'=>$timeZone,'currencies'=>array_values($currencies),'recentOrders'=>$history];
 }
}
