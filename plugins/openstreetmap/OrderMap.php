<?php
declare(strict_types=1);
namespace dyws\Plugins\OpenStreetMap;
use dyws\{Store,ApiError,Catalog,Entitlements};
require_once __DIR__.'/AddressCache.php';
final class OrderMap {
 private AddressCache $addressCache;
 public function __construct(private Store $store,private array $config,private mixed $geocoder=null){$this->addressCache=new AddressCache($store,$config);}
 private function scope(array $query):array {
  $zone=(new \dyws\Settings($this->config))->read()['timeZone'];$tz=new \DateTimeZone($zone);$today=new \DateTimeImmutable('today',$tz);$from=$query['from']??$today->modify('-29 days')->format('Y-m-d');$to=$query['to']??$today->format('Y-m-d');
  $parse=static function($v)use($tz){if(!is_string($v)||!preg_match('/^\d{4}-\d{2}-\d{2}$/D',$v))throw new ApiError('Choose valid map dates.');$d=\DateTimeImmutable::createFromFormat('!Y-m-d',$v,$tz);if(!$d||$d->format('Y-m-d')!==$v)throw new ApiError('Choose valid map dates.');return $d;};$start=$parse($from);$end=$parse($to);if($end<$start||(int)$start->diff($end)->format('%a')>365)throw new ApiError('Choose up to 366 days.');
  $currency=$query['currency']??Catalog::load($this->config['catalog'])['currency'];$type=$query['fulfillment']??'all';$status=$query['status']??'all';$location=$query['location']??'*';
  if(!is_string($currency)||!preg_match('/^[A-Z]{3}$/D',$currency)||!in_array($type,['all','delivery','pickup'],true)||!in_array($status,['all','placed','accepted','preparing','ready','out_for_delivery','delivered','completed','cancelled'],true)||!is_string($location)||($location!=='*'&&!preg_match('/^[a-zA-Z0-9_-]{0,80}$/D',$location)))throw new ApiError('Choose valid map filters.');
  return ['from'=>$from,'to'=>$to,'start'=>$start->getTimestamp(),'end'=>$end->modify('+1 day')->getTimestamp(),'currency'=>$currency,'fulfillment'=>$type,'status'=>$status,'location'=>$location,'timeZone'=>$zone];
 }
 private function address(array $row):array {
  $business=json_decode($row['order_location_json'],true)?:[];
  if($row['fulfillment']==='pickup')$address=$business['address']??'';
  else{$a=json_decode($row['address_json'],true)?:[];$address=implode(', ',array_filter(array_intersect_key($a,array_flip(['line1','city','region','postalCode','country'])),fn($v)=>is_string($v)&&$v!==''));if($address==='')$address=$row['address'];}
  $address=mb_substr(trim(preg_replace('/\s+/u',' ',(string)$address)??''),0,240);$hash=$this->addressCache->key($address,$row['fulfillment']);
  return ['address'=>$address,'hash'=>$hash,'locationId'=>(string)($business['id']??''),'name'=>(string)($business['name']??'Business')];
 }
 private function snapshot(array $query):array {
  Entitlements::requireReports($this->config);$scope=$this->scope($query);$own=!$this->store->db->inTransaction();if($own)$this->store->db->beginTransaction();try{$where='tenant=? AND created_at>=? AND created_at<? AND currency=?';$args=[$this->store->tenant,$scope['start'],$scope['end'],$scope['currency']];
  foreach(['fulfillment','status'] as $key)if($scope[$key]!=='all'){$where.=' AND '.$key.'=?';$args[]=$scope[$key];}
  if($scope['location']!=='*'){$where.=" AND COALESCE(CASE WHEN json_valid(order_location_json) THEN json_extract(order_location_json,'$.id') END,'')=?";$args[]=$scope['location'];}
  $total=(int)$this->store->query('SELECT COUNT(*) AS n FROM orders WHERE '.$where,$args)[0]['n'];$rows=$this->store->query('SELECT id,created_at,fulfillment,status,total,tip,address,address_json,order_location_json FROM orders WHERE '.$where.' ORDER BY created_at DESC,id DESC LIMIT 10000',$args);$hashes=[];
  foreach($rows as &$row){$row['_geo']=$this->address($row);$hashes[$row['_geo']['hash']]=true;}unset($row);$cache=[];
  foreach(array_chunk(array_keys($hashes),400) as $chunk){$in=implode(',',array_fill(0,count($chunk),'?'));foreach($this->store->query('SELECT * FROM osm_address_geography WHERE tenant=? AND address_hash IN ('.$in.')',[$this->store->tenant,...$chunk]) as $v)$cache[$v['address_hash']]=$v;}
  if($own)$this->store->db->commit();return [$scope,$rows,$cache,$total];}catch(\Throwable $error){if($own&&$this->store->db->inTransaction())$this->store->db->rollBack();throw $error;}
 }
 private function businessPoints():array {$out=[];foreach((new Settings($this->config))->read()['businessPoints'] as $p)$out[$p['locationId']]=$p;return $out;}
 public function dataset(array $query):array {
  [$scope,$rows,$cache,$total]=$this->snapshot($query);$points=$this->businessPoints();$groups=[];$branches=[];$mapped=0;$coverage=['delivery'=>['orders'=>0,'mapped'=>0,'unmapped'=>0,'pending'=>0],'pickup'=>['orders'=>0,'mapped'=>0,'unmapped'=>0,'pending'=>0]];$reasons=['noAddress'=>0,'notLocated'=>0,'unmatched'=>0];
  foreach($rows as $row){$coverage[$row['fulfillment']]['orders']++;$meta=$row['_geo'];$branches[$meta['locationId']]=$meta['name'];$point=$row['fulfillment']==='pickup'?($points[$meta['locationId']]??null):null;$point??=$cache[$meta['hash']]??null;
   if(!$point||($point['status']??'located')!=='located'){$coverage[$row['fulfillment']]['unmapped']++;if($meta['address']==='')$reasons['noAddress']++;elseif(($point['status']??'')==='unmatched')$reasons['unmatched']++;else{$reasons['notLocated']++;$coverage[$row['fulfillment']]['pending']++;}continue;}
   $mapped++;$coverage[$row['fulfillment']]['mapped']++;$lat=(float)$point['latitude'];$lon=(float)$point['longitude'];if($row['fulfillment']==='delivery'){$lat=round($lat,2);$lon=round($lon,2);}$key=$row['fulfillment'].'|'.$lat.'|'.$lon.'|'.($row['fulfillment']==='pickup'?$meta['locationId']:'');
   $groups[$key]??=['id'=>substr(hash('sha256',$key),0,16),'layer'=>$row['fulfillment'],'latitude'=>$lat,'longitude'=>$lon,'locationId'=>$row['fulfillment']==='pickup'?$meta['locationId']:null,'name'=>$row['fulfillment']==='pickup'?$meta['name']:'Area '.$lat.', '.$lon,'orders'=>0,'orderedValueExcludingTips'=>0,'statuses'=>[]];$g=&$groups[$key];$g['orders']++;if($row['status']!=='cancelled')$g['orderedValueExcludingTips']+=(int)$row['total']-(int)$row['tip'];$g['statuses'][$row['status']]=($g['statuses'][$row['status']]??0)+1;unset($g);
  }
  $publicScope=array_diff_key($scope,array_flip(['start','end']));$catalog=Catalog::load($this->config['catalog']);foreach($catalog['locations']?:[['id'=>'','name'=>$catalog['businessName']]] as $branch)$branches[$branch['id']]=$branch['name'];$locations=[];foreach($branches as $id=>$name)$locations[]=['id'=>$id,'name'=>$name];
  return ['schemaVersion'=>1,'scope'=>$publicScope,'demo'=>!empty($this->config['demo_lockdown']),'totalOrders'=>$total,'shownOrders'=>count($rows),'mappedOrders'=>$mapped,'unmappedOrders'=>count($rows)-$mapped,'omittedOrders'=>max(0,$total-count($rows)),'coverageByLayer'=>$coverage,'unmappedReasons'=>$reasons,'groups'=>array_values($groups),'locations'=>$locations,'precision'=>'Delivery coordinates are approximate areas at 0.01 degree precision. Pickup points represent business locations. No driver GPS or customer contacts.','geocoderReady'=>$this->geocoderReady()];
 }
 public function geocoderReady():bool {
  if(is_callable($this->geocoder))return true;
  if(!in_array('nominatim',$this->store->plugins?->activeIds()??[],true)||!class_exists(\dyws\Plugins\Nominatim\AddressLookup::class)||!method_exists(\dyws\Plugins\Nominatim\AddressLookup::class,'geocodeForMap'))return false;
  $state=(new \dyws\Plugins\Nominatim\AddressLookup($this->config))->summary();return $state['enabled']&&$state['configured']&&!$state['demo'];
 }
 /** Explicit manager action. Never geocode merely because someone views a map. */
 public function geocodeNext(array $query):array {
  [$scope,$rows,$cache]=$this->snapshot($query);if(!$this->geocoderReady())throw new ApiError('Enable and configure your own Nominatim service first. Demo mode never sends addresses.',503);$points=$this->businessPoints();
  foreach($rows as $row){$meta=$row['_geo'];if($meta['address']===''||isset($cache[$meta['hash']])||($row['fulfillment']==='pickup'&&isset($points[$meta['locationId']])))continue;
   $lease=bin2hex(random_bytes(8));$claim=$this->store->db->prepare('INSERT INTO osm_geocode_leases VALUES(?,?,?,?) ON CONFLICT(tenant,address_hash) DO UPDATE SET token=excluded.token,expires_at=excluded.expires_at WHERE osm_geocode_leases.expires_at<?');$claim->execute([$this->store->tenant,$meta['hash'],$lease,time()+30,time()]);if($claim->rowCount()===0)continue;
   try{
   $point=is_callable($this->geocoder)?($this->geocoder)($meta['address']):(new \dyws\Plugins\Nominatim\AddressLookup($this->config))->geocodeForMap($meta['address']);
   if($point!==null&&(!isset($point['latitude'],$point['longitude'])||!is_numeric($point['latitude'])||!is_numeric($point['longitude'])||!is_finite((float)$point['latitude'])||!is_finite((float)$point['longitude'])||abs((float)$point['latitude'])>90||abs((float)$point['longitude'])>180))throw new ApiError('The address service returned invalid coordinates.',503);
   $this->addressCache->remember($meta['address'],$row['fulfillment'],$point);return ['processed'=>1,'located'=>$point!==null?1:0,'unmatched'=>$point===null?1:0];}finally{$this->store->execute('DELETE FROM osm_geocode_leases WHERE tenant=? AND address_hash=? AND token=?',[$this->store->tenant,$meta['hash'],$lease]);}
  }
  return ['processed'=>0,'located'=>0,'unmatched'=>0];
 }
}
