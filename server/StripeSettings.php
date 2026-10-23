<?php
declare(strict_types=1);
namespace StarlitGo;

/** Private encrypted credential storage for the shared hosting demo. */
final class StripeSettings {
 private string $path; private string $key;
 public function __construct(private array $config){$this->path=dirname($config['database']).'/stripe.json';$this->key=hash_hkdf('sha256',$config['tracking_secret'],32,'starlit-go-stripe:'.$config['tenant']);}
 public function read():array {
  if(!is_file($this->path))return ['enabled'=>false,'apiKey'=>'','webhookSecret'=>''];
  $d=json_decode(file_get_contents($this->path),true,32,JSON_THROW_ON_ERROR);
  $plain=openssl_decrypt(base64_decode($d['ciphertext']),'aes-256-gcm',$this->key,OPENSSL_RAW_DATA,base64_decode($d['iv']),base64_decode($d['tag']),$this->config['tenant']);
  if($plain===false)throw new ApiError('Payment configuration could not be opened.',503);
  return json_decode($plain,true,32,JSON_THROW_ON_ERROR);
 }
 public function summary():array {$s=$this->read();return ['enabled'=>$s['enabled'],'mode'=>'test','hasApiKey'=>$s['apiKey']!=='','hasWebhookSecret'=>$s['webhookSecret']!=='','webhookUrl'=>($this->config['public_base_url']??'').'/api/index.php?route=/stripe/webhook'];}
 public function save(array $body):array {
  $lock=fopen($this->path.'.lock','c');if(!$lock||!flock($lock,LOCK_EX))throw new ApiError('Payment settings are busy.',503);
  try{$s=$this->read();
   foreach(['apiKey','webhookSecret'] as $field){$value=$body[$field]??'';if(!is_string($value)||strlen($value)>300)throw new ApiError('Invalid payment credentials.');if(trim($value)!=='')$s[$field]=trim($value);}
   if($s['apiKey']!==''&&!preg_match('/^[rs]k_test_[A-Za-z0-9]{12,}$/',$s['apiKey']))throw new ApiError('Use a Stripe sandbox restricted key. Live keys are not enabled in this demo.');
   if($s['webhookSecret']!==''&&!preg_match('/^whsec_[A-Za-z0-9]{12,}$/',$s['webhookSecret']))throw new ApiError('Enter the webhook signing secret from Stripe.');
   if(!is_bool($body['enabled']??null))throw new ApiError('Choose whether Stripe checkout is enabled.');$s['enabled']=$body['enabled'];
   if($s['enabled']&&($s['apiKey']===''||$s['webhookSecret']===''||empty($this->config['public_base_url'])))throw new ApiError('Configure the API key, webhook secret and public site URL before enabling checkout.');
   $iv=random_bytes(12);$tag='';$cipher=openssl_encrypt(json_encode($s,JSON_THROW_ON_ERROR),'aes-256-gcm',$this->key,OPENSSL_RAW_DATA,$iv,$tag,$this->config['tenant']);
   if($cipher===false)throw new ApiError('Could not encrypt payment settings.',503);
   Catalog::write($this->path,['iv'=>base64_encode($iv),'tag'=>base64_encode($tag),'ciphertext'=>base64_encode($cipher)]);
   return $this->summary();
  }finally{flock($lock,LOCK_UN);fclose($lock);}
 }
}
