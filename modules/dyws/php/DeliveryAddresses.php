<?php
declare(strict_types=1);
namespace dyws;

/** Permanent destinations and verified customer associations, independent of map providers. */
final class DeliveryAddresses {
 private const FIELDS=['line1','line2','city','region','postalCode','country'];
 public function __construct(private Store $store){}
 private static function normalized(string $value):string {
  return mb_strtolower(trim(preg_replace('/\s+/u',' ',$value)??$value),'UTF-8');
 }
 /** Conservative equality: never infer a city, unit or household from partial text. */
 private static function key(array $details,string $text):string {
  if(($details['line1']??'')==='')return hash('sha256',json_encode(['v'=>1,'freeform'=>self::normalized($text)],JSON_THROW_ON_ERROR));
  $parts=[];foreach(self::FIELDS as $field)$parts[$field]=self::normalized($details[$field]??'');
  $parts['postalCode']=str_replace(' ','',$parts['postalCode']);
  $parts['country']=['canada'=>'ca','united states'=>'us','united states of america'=>'us','usa'=>'us'][$parts['country']]??$parts['country'];
  if($parts['country']==='ca')$parts['region']=['alberta'=>'ab','british columbia'=>'bc','manitoba'=>'mb','new brunswick'=>'nb','newfoundland and labrador'=>'nl','northwest territories'=>'nt','nova scotia'=>'ns','nunavut'=>'nu','ontario'=>'on','prince edward island'=>'pe','quebec'=>'qc','québec'=>'qc','saskatchewan'=>'sk','yukon'=>'yt'][$parts['region']]??$parts['region'];
  // Unit prefixes are labels, but the complete unit value remains part of the identity.
  $parts['line2']=preg_replace('/^(?:unit\s+|apartment\s+|apt\.?\s+|suite\s+|ste\.?\s+|#\s*)(?=\S)/u','',$parts['line2']);
  return hash('sha256',json_encode(['v'=>1,'structured'=>$parts],JSON_THROW_ON_ERROR));
 }
 /** Internal API. Call within the surrounding order or migration transaction. */
 public function resolve(array $details,string $text,int $createdAt):?string {
  if(trim($text)===''&&trim($details['line1']??'')==='')return null;
  $s=$this->store;$key=self::key($details,$text);
  $existing=$s->query('SELECT id FROM delivery_addresses WHERE tenant=? AND address_key=?',[$s->tenant,$key])[0]??null;
  if($existing)return $existing['id'];
  $id='ADR-'.strtoupper(bin2hex(random_bytes(12)));
  $s->execute('INSERT INTO delivery_addresses(tenant,id,address_key,address_json,address_text,created_at) VALUES(?,?,?,?,?,?)',[$s->tenant,$id,$key,json_encode($details?:new \stdClass(),JSON_THROW_ON_ERROR),$text,$createdAt]);
  return $id;
 }
 private static function details(string $json):array {
  $details=json_decode($json,true);if(!is_array($details)||!is_string($details['line1']??null)||trim($details['line1'])==='')return [];
  $result=[];foreach(self::FIELDS as $field)$result[$field]=is_string($details[$field]??null)?$details[$field]:'';return $result;
 }
 /** The customer ID comes from trusted account ownership, never submitted address IDs. */
 public function ordered(array $order):?string {
  if($order['fulfillment']!=='delivery')return null;
  $s=$this->store;$id=$order['delivery_address_id']??$this->resolve(self::details($order['address_json']),$order['address'],(int)$order['created_at']);
  if(!$id)return null;
  if(empty($order['delivery_address_id']))$s->execute('UPDATE orders SET delivery_address_id=? WHERE tenant=? AND id=?',[$id,$s->tenant,$order['id']]);
  if(!empty($order['customer_id']))$s->execute('INSERT INTO customer_delivery_addresses(tenant,customer_id,address_id,first_used_at,last_used_at) VALUES(?,?,?,?,?) ON CONFLICT(tenant,customer_id,address_id) DO UPDATE SET first_used_at=min(first_used_at,excluded.first_used_at),last_used_at=max(last_used_at,excluded.last_used_at)',[$s->tenant,$order['customer_id'],$id,(int)$order['created_at'],(int)$order['created_at']]);
  return $id;
 }
 /** Repeatable migration preserves receipts, capabilities and editable guest address book IDs. */
 public function backfill():void {
  $s=$this->store;
  do{
   $rows=$s->query("SELECT * FROM orders WHERE tenant=? AND fulfillment='delivery' AND delivery_address_id IS NULL AND trim(address)<>'' LIMIT 200",[$s->tenant]);
   foreach($rows as $order)$this->ordered($order);
  }while(count($rows)===200);
  $profile='';$bookmark='';
  do{
   $rows=$s->query('SELECT * FROM guest_addresses WHERE tenant=? AND delivery_address_id IS NULL AND (profile_id,id)>(?,?) ORDER BY profile_id,id LIMIT 200',[$s->tenant,$profile,$bookmark]);
   foreach($rows as $row){
    $profile=$row['profile_id'];$bookmark=$row['id'];
    $details=self::details($row['address_json']);$text=implode(', ',array_filter($details,fn($v)=>$v!==''));
    $id=$this->resolve($details,$text,(int)$row['created_at']);
    if($id)$s->execute('UPDATE guest_addresses SET delivery_address_id=? WHERE tenant=? AND profile_id=? AND id=?',[$id,$s->tenant,$profile,$bookmark]);
   }
  }while(count($rows)===200);
 }
 public function listing(string $customer,int $offset=0):array {
  $s=$this->store;$rows=$s->query('SELECT a.id,a.address_json,a.address_text,c.first_used_at,c.last_used_at FROM customer_delivery_addresses c JOIN delivery_addresses a ON a.tenant=c.tenant AND a.id=c.address_id WHERE c.tenant=? AND c.customer_id=? ORDER BY c.last_used_at DESC,c.address_id LIMIT 21 OFFSET '.max(0,$offset),[$s->tenant,$customer]);
  return ['addresses'=>array_map(static fn($r)=>['id'=>$r['id'],'addressDetails'=>json_decode($r['address_json']),'address'=>$r['address_text'],'firstUsedAt'=>(int)$r['first_used_at'],'lastUsedAt'=>(int)$r['last_used_at']],array_slice($rows,0,20)),'nextOffset'=>count($rows)>20?$offset+20:null];
 }
}
