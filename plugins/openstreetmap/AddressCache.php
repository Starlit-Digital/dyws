<?php
declare(strict_types=1);
namespace dyws\Plugins\OpenStreetMap;
use dyws\{Store,ApiError};
/** Tenant scoped persistent cache. Never stores names or contact details. */
final class AddressCache {
 public function __construct(private Store $store,private array $config){$store->db->exec(file_get_contents(__DIR__.'/schema.sql'));}
 public function key(string $address,string $fulfillment):string {
  if(!in_array($fulfillment,['pickup','delivery'],true))throw new ApiError('Choose a valid location layer.');
  $address=mb_substr(trim(preg_replace('/\s+/u',' ',$address)??''),0,240);
  return hash_hmac('sha256',$fulfillment.'|'.mb_strtolower($address),$this->config['tracking_secret']);
 }
 public function remember(string $address,string $fulfillment,?array $point):void {
  $hash=$this->key($address,$fulfillment);$lat=$lon=null;
  if($point!==null){foreach(['latitude'=>90,'longitude'=>180] as $key=>$bound)if(!is_numeric($point[$key]??null)||!is_finite((float)$point[$key])||abs((float)$point[$key])>$bound)throw new ApiError('The address service returned invalid coordinates.',503);$precision=$fulfillment==='delivery'?2:5;$lat=round((float)$point['latitude'],$precision);$lon=round((float)$point['longitude'],$precision);}
  $this->store->execute('INSERT INTO osm_address_geography VALUES(?,?,?,?,?,?) ON CONFLICT(tenant,address_hash) DO UPDATE SET latitude=excluded.latitude,longitude=excluded.longitude,status=excluded.status,updated_at=excluded.updated_at',[$this->store->tenant,$hash,$lat,$lon,$point===null?'unmatched':'located',time()]);
 }
}
