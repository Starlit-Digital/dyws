<?php
declare(strict_types=1);
namespace dyws;
require_once __DIR__.'/OrderArchive.php';

/** History belongs to the authenticated driver's assignments, not to a browser supplied ID. */
final class DriverOrders {
 public static function history(Store $store,string $driver,int $limit=20,bool $archived=false):array {
  if($limit<1||$limit>200)throw new ApiError('Choose a history limit from 1 to 200.');
  new OrderArchive($store);
  $rows=$store->query("SELECT o.id,o.status,o.payment_status,o.fulfillment,o.currency,o.subtotal,o.tax,o.delivery_fee,o.total,o.tip,o.driver_id,o.created_at,o.updated_at,o.lines_json FROM orders o WHERE o.tenant=? AND o.driver_id=? AND o.status IN ('delivered','completed','cancelled') AND ".($archived?'':'NOT ').OrderArchive::predicate()." ORDER BY o.updated_at DESC,o.id DESC LIMIT ".$limit,[$store->tenant,$driver,'driver',$driver]);
  return array_map(static function($row)use($archived){$row['archived']=$archived;$row['historical']=true;$row['lines']=array_map(static fn($line)=>array_intersect_key($line,array_flip(['id','variant','name','option','quantity','price'])),json_decode($row['lines_json'],true,512,JSON_THROW_ON_ERROR));unset($row['lines_json']);return $row;},$rows);
 }
}
