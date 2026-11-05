<?php
declare(strict_types=1);
namespace dyws;

/** Archiving is an operator visibility preference, never an order or payment transition. */
final class OrderArchive {
 private const STATUSES="'placed','accepted','preparing','ready','out_for_delivery','delivered','completed','cancelled'";
 public function __construct(private Store $store){
  $store->db->exec('CREATE TABLE IF NOT EXISTS order_archives (tenant TEXT NOT NULL,order_id TEXT NOT NULL,role TEXT NOT NULL,subject TEXT NOT NULL,status TEXT NOT NULL,status_event_id INTEGER NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(tenant,order_id,role,subject),FOREIGN KEY(tenant,order_id) REFERENCES orders(tenant,id))');
  $store->db->exec('CREATE TABLE IF NOT EXISTS order_archive_edits (id INTEGER PRIMARY KEY,tenant TEXT NOT NULL,order_id TEXT NOT NULL,role TEXT NOT NULL,subject TEXT NOT NULL,archived INTEGER NOT NULL,created_at INTEGER NOT NULL,FOREIGN KEY(tenant,order_id) REFERENCES orders(tenant,id))');
 }
 /** A later status change automatically returns the order to the ordinary view. Alias o is internal. */
 public static function predicate():string {
  return "EXISTS (SELECT 1 FROM order_archives a WHERE a.tenant=o.tenant AND a.order_id=o.id AND a.role=? AND a.subject=? AND a.status=o.status AND o.status IN ('delivered','completed','cancelled') AND a.status_event_id=COALESCE((SELECT max(e.id) FROM events e WHERE e.tenant=o.tenant AND e.order_id=o.id AND e.status IN (".self::STATUSES.")),0))";
 }
 public function managerOrders(bool $archived=false):array {
  $rows=$this->store->query("SELECT o.* FROM orders o WHERE o.tenant=? AND ".($archived?'':'NOT ').self::predicate()." ORDER BY CASE WHEN o.status IN ('completed','delivered','cancelled') THEN 1 ELSE 0 END, CASE WHEN o.status IN ('completed','delivered','cancelled') THEN -o.created_at ELSE COALESCE(CAST(json_extract(o.fulfillment_meta_json,'$.scheduledAt') AS INTEGER)-1800,o.created_at) END,o.id LIMIT 200",[$this->store->tenant,'manager','manager']);
  return array_map(fn($row)=>$this->store->safeOrder($row)+['archived'=>$archived],$rows);
 }
 public function apply(string $id,array $session,array $body):array {
  $role=$session['role']??'';if(!in_array($role,['manager','driver'],true))throw new ApiError('This role cannot archive orders.',403);
  if(!is_bool($body['archived']??null))throw new ApiError('Choose whether to archive or restore the order.');
  $subject=$role==='manager'?'manager':$session['subject'];$archive=$body['archived'];
  return $this->store->transaction(function()use($id,$role,$subject,$archive){
   $order=$this->store->get($id);
   if($role==='driver'&&$order['driver_id']!==$subject)throw new ApiError('Order not found.',404);
   if($archive&&!in_array($order['status'],['delivered','completed','cancelled'],true))throw new ApiError('Finish or cancel this order before archiving it.',409);
   $args=[$this->store->tenant,$id,$role,$subject];
   $current=(bool)$this->store->query('SELECT 1 FROM orders o WHERE o.tenant=? AND o.id=? AND '.self::predicate(),$args);
   if($current!==$archive){
    if($archive){$checkpoint=(int)$this->store->query('SELECT COALESCE(max(id),0) AS n FROM events WHERE tenant=? AND order_id=? AND status IN ('.self::STATUSES.')',[$this->store->tenant,$id])[0]['n'];
     $this->store->execute('INSERT INTO order_archives(tenant,order_id,role,subject,status,status_event_id,created_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(tenant,order_id,role,subject) DO UPDATE SET status=excluded.status,status_event_id=excluded.status_event_id,created_at=excluded.created_at',array_merge($args,[$order['status'],$checkpoint,time()]));
    }else $this->store->execute('DELETE FROM order_archives WHERE tenant=? AND order_id=? AND role=? AND subject=?',$args);
    $this->store->execute('INSERT INTO order_archive_edits(tenant,order_id,role,subject,archived,created_at) VALUES(?,?,?,?,?,?)',array_merge($args,[(int)$archive,time()]));
   }
   return ['id'=>$id,'archived'=>$archive];
  });
 }
}
