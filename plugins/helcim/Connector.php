<?php
declare(strict_types=1);
namespace dyws\Plugins\Helcim;
final class Connector extends \dyws\Payments\Connector {
 protected function connection():string{$this->request('terminals.list');return 'API token accepted. Use a Helcim developer test account; Helcim uses the same API hostname for test and live accounts.';}
 public function request(string $operation,array $arguments=[]):array {
  $headers=['api-token: '.$this->credentials()['apiToken']];$base='https://api.helcim.com/v2';
  return match($operation){
   'terminals.list'=>$this->http('GET',$base.'/card-terminals',$headers),
   'checkout.create'=>$this->http('POST',$base.'/helcim-pay/initialize',$headers,$this->payload($arguments)),
   'transaction.get'=>$this->http('GET',$base.'/card-transactions/'.$this->id($arguments),$headers),
   default=>throw new \dyws\ApiError('Unsupported Helcim operation.')};
 }
 public function verifyEvent(string $raw,array $headers):array {
  $s=$this->credentials();$timestamp=$headers['HTTP_WEBHOOK_TIMESTAMP']??'';$this->timestamp($timestamp);$id=$headers['HTTP_WEBHOOK_ID']??'';if($id==='')throw new \dyws\ApiError('Missing webhook identifier.',400);
  $key=base64_decode($s['webhookSecret'],true);if($key===false||$key==='')throw new \dyws\ApiError('Invalid webhook verifier token.',400);
  $expected=base64_encode(hash_hmac('sha256',$id.'.'.$timestamp.'.'.$raw,$key,true));$valid=false;foreach(explode(' ',$headers['HTTP_WEBHOOK_SIGNATURE']??'') as $signature)if(hash_equals('v1,'.$expected,$signature))$valid=true;
  if(!$valid)throw new \dyws\ApiError('Invalid Helcim signature.',400);return $this->event($raw);
 }
}
