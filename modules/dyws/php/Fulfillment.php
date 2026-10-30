<?php
declare(strict_types=1);
namespace dyws;
require_once __DIR__.'/LocalTime.php';
/** Historical fulfillment snapshots remain readable with all plugins removed. */
final class Fulfillment {
 public static function read(array $order):array {
  $saved=json_decode($order['fulfillment_meta_json']??'{}',true);
  if(($saved['version']??null)===1)return $saved;
  // Legacy orders have no historical zone snapshot. Do not invent one.
  $type=$order['fulfillment'];$location=json_decode($order['order_location_json']??'{}',true);
  return ['version'=>1,'type'=>$type,'label'=>$type==='delivery'?'Delivery':'Pickup','scheduled'=>false,'scheduledAt'=>null,'scheduledAtUtc'=>null,'localDate'=>null,'localTime'=>null,'timeZone'=>null,'locationId'=>$location['id']??''];
 }
}
