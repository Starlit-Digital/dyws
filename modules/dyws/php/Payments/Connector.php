<?php
declare(strict_types=1);
namespace dyws\Payments;
use dyws\{ApiError,Catalog,Store};

/** Shared transport and encrypted storage. Provider contracts remain in their plugins. */
abstract class Connector {
 private string $path;private string $key;
 public function __construct(protected array $config,protected array $definition,private $transport=null){
  $id=$definition['id'];$this->path=dirname($config['database']).'/payment-'.$id.'-'.substr(hash('sha256',$config['tenant']),0,16).'.json';
  $this->key=hash_hkdf('sha256',$config['tracking_secret'],32,'dyws-payment:'.$id.':'.$config['tenant']);
 }
 public function definition():array{return $this->definition;}
 /** Pure preparation for a trusted checkout integration. No network or ledger write. */
 public function checkoutArguments(Store $store,string $id):array {
  if($store->tenant!==$this->config['tenant'])throw new ApiError('Payment belongs to another business.',403);
  $order=$store->get($id);
  if($order['payment_provider']!==$this->definition['id']||$order['payment_status']!=='unpaid'||$order['status']==='cancelled')throw new ApiError('This order is not available for this payment connector.',409);
  if((int)$order['total']!==(int)$order['subtotal']+(int)$order['tax']+(int)$order['delivery_fee']+(int)$order['tip'])throw new ApiError('Order payment components do not reconcile.',409);
  $key=substr(hash('sha256',$store->tenant.'|'.$id.'|'.$this->definition['id']),0,32);
  return ['payload'=>$this->orderPayload($order,$key),'idempotencyKey'=>$key];
 }
 protected function orderPayload(array $order,string $key):array {throw new ApiError('Order checkout preparation is unavailable.',409);}
 protected static function decimal(int $cents):string{return intdiv($cents,100).'.'.str_pad((string)($cents%100),2,'0',STR_PAD_LEFT);}
 protected static function charges(array $order):array {
  $lines=[];foreach(['subtotal'=>'Order items','delivery_fee'=>'Delivery fee','tax'=>'Configured tax','tip'=>'Tip'] as $field=>$name)if($order[$field]>0)$lines[]=['name'=>$name,'amount'=>(int)$order[$field]];
  return $lines;
 }
 public function read():array {
  if(!is_file($this->path))return ['environment'=>'sandbox','credentials'=>[],'verifiedAt'=>null];
  try{$d=json_decode(file_get_contents($this->path),true,32,JSON_THROW_ON_ERROR);$plain=openssl_decrypt(base64_decode($d['ciphertext'],true),'aes-256-gcm',$this->key,OPENSSL_RAW_DATA,base64_decode($d['iv'],true),base64_decode($d['tag'],true),$this->config['tenant']);if($plain===false)throw new \RuntimeException();return json_decode($plain,true,32,JSON_THROW_ON_ERROR);}catch(\Throwable){throw new ApiError('Payment credentials could not be opened.',503);}
 }
 public function summary():array {
  $s=$this->read();$fields=[];$ready=true;
  foreach($this->definition['fields'] as $f){$has=($s['credentials'][$f['id']]??'')!=='';$ready=$ready&&(!$f['required']||$has);$fields[]=$f+['saved'=>$has];}
  $state=['environment'=>$s['environment'],'configured'=>$ready,'verifiedAt'=>$s['verifiedAt'],'fields'=>$fields];
  return ['id'=>$this->definition['id'],'name'=>$this->definition['name'],'stage'=>'connector','checkoutEnabled'=>false,'notice'=>'Connector foundation. Configuring or activating this plugin does not enable customer payments.','documentation'=>$this->definition['documentation'],'operations'=>$this->definition['operations'],'webhookUrl'=>$this->webhookUrl(),'revision'=>Catalog::revision($s)]+$state;
 }
 public function webhookUrl():?string{return !empty($this->definition['webhook'])?rtrim($this->config['public_base_url']??'','/').'/api/?route='.$this->definition['webhook']:null;}
 private function write(array $s):void{$iv=random_bytes(12);$tag='';$cipher=openssl_encrypt(json_encode($s,JSON_THROW_ON_ERROR),'aes-256-gcm',$this->key,OPENSSL_RAW_DATA,$iv,$tag,$this->config['tenant']);if($cipher===false)throw new ApiError('Could not encrypt credentials.',503);Catalog::write($this->path,['iv'=>base64_encode($iv),'tag'=>base64_encode($tag),'ciphertext'=>base64_encode($cipher)]);}
 public function save(array $body):array {
  $lock=fopen($this->path.'.lock','c');if(!$lock||!flock($lock,LOCK_EX))throw new ApiError('Payment settings are busy.',503);
  try{$s=$this->read();if(!hash_equals(Catalog::revision($s),Store::text($body['revision']??null,64)))throw new ApiError('Settings changed. Reload before saving.',409);
   // Hosted demos and this development release expose sandbox connections only.
   if(($body['environment']??'sandbox')!=='sandbox')throw new ApiError('Use the sandbox environment.');
   $credentials=$body['credentials']??[];if(!is_array($credentials)||!is_array($body['clear']??[]))throw new ApiError('Check credential fields.');
   $known=array_column($this->definition['fields'],null,'id');foreach(array_keys($credentials) as $id)if(!isset($known[$id]))throw new ApiError('Unknown credential field.');
   foreach($body['clear']??[] as $id){if(!is_string($id)||!isset($known[$id]))throw new ApiError('Unknown credential field.');unset($s['credentials'][$id]);}
   foreach($credentials as $id=>$value){$value=Store::text($value,4096,false);if(preg_match('/[\r\n\x00]/',$value))throw new ApiError('Credentials must be a single line.');if($value!=='')$s['credentials'][$id]=$value;}
   $s['verifiedAt']=null;$this->write($s);return $this->summary();
  }finally{flock($lock,LOCK_UN);fclose($lock);}
 }
 protected function credentials():array{$s=$this->read();foreach($this->definition['fields'] as $f)if($f['required']&&empty($s['credentials'][$f['id']]))throw new ApiError('Save the required sandbox credentials first.',409);return $s['credentials'];}
 public function verify():array {
  $before=$this->read();$result=$this->connection();
  $lock=fopen($this->path.'.lock','c');if(!$lock||!flock($lock,LOCK_EX))throw new ApiError('Payment settings are busy.',503);
  try{if(Catalog::revision($this->read())!==Catalog::revision($before))throw new ApiError('Credentials changed during verification. Check the connection again.',409);$before['verifiedAt']=time();$this->write($before);}finally{flock($lock,LOCK_UN);fclose($lock);}
  return ['ok'=>true,'environment'=>'sandbox','checkedAt'=>$before['verifiedAt'],'detail'=>$result];
 }
 abstract protected function connection():string;
 /** Trusted server extensions only. Never expose raw API operations to a browser. */
 abstract public function request(string $operation,array $arguments=[]):array;
 public function verifyEvent(string $raw,array $headers):array{throw new ApiError('Use authenticated receipt retrieval for this connector.',405);}
 protected function http(string $method,string $url,array $headers=[],?array $body=null,bool $form=false):array {
  if(!str_starts_with($url,'https://'))throw new ApiError('Secure provider transport is required.',503);
  if($this->transport)return ($this->transport)($method,$url,$headers,$body,$form);
  $ch=curl_init($url);$headers[]='Accept: application/json';$headers[]='User-Agent: dyws/0.10.0';
  if($body!==null)$headers[]='Content-Type: '.($form?'application/x-www-form-urlencoded':'application/json');
  curl_setopt_array($ch,[CURLOPT_CUSTOMREQUEST=>$method,CURLOPT_HTTPHEADER=>$headers,CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>20,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS]);
  if($body!==null)curl_setopt($ch,CURLOPT_POSTFIELDS,$form?http_build_query($body):json_encode($body,JSON_THROW_ON_ERROR));
  $raw=curl_exec($ch);$code=curl_getinfo($ch,CURLINFO_RESPONSE_CODE);curl_close($ch);
  if(!is_string($raw)||$code<200||$code>=300||strlen($raw)>1048576)throw new ApiError('The provider could not complete this request. Check sandbox credentials and permissions.',502);
  try{$data=json_decode(ltrim($raw,"\xEF\xBB\xBF"),true,64,JSON_THROW_ON_ERROR);if(!is_array($data))throw new \RuntimeException();return $data;}catch(\Throwable){throw new ApiError('The provider returned an invalid response.',502);}
 }
 protected function id(array $args,string $key='id'):string{$id=Store::text($args[$key]??null,200);if(!preg_match('/^[A-Za-z0-9_-]+$/D',$id))throw new ApiError('Invalid provider identifier.');return rawurlencode($id);}
 protected function payload(array $args):array {if(!is_array($args['payload']??null))throw new ApiError('A provider payload is required.');return $args['payload'];}
 protected function signature(string $actual,string $expected):void{if($actual===''||!hash_equals($expected,$actual))throw new ApiError('Invalid provider signature.',400);}
 protected function event(string $raw):array{try{$data=json_decode($raw,true,64,JSON_THROW_ON_ERROR);if(!is_array($data))throw new \RuntimeException();return $data;}catch(\Throwable){throw new ApiError('Invalid provider event.',400);}}
 protected function timestamp(string $timestamp):void{if(!ctype_digit($timestamp)||abs(time()-(int)$timestamp)>300)throw new ApiError('Expired provider signature.',400);}
}
