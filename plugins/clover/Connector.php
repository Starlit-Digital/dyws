<?php
declare(strict_types=1);
namespace dyws\Plugins\Clover;
final class Connector extends \dyws\Payments\Connector {
 protected function connection():string{$r=$this->request('merchant.get');if(($r['id']??'')!==$this->credentials()['merchantId'])throw new \dyws\ApiError('The Clover merchant does not match.');return 'Sandbox merchant connection verified. Hosted Checkout permissions need a checkout session test.';}
 public function request(string $operation,array $arguments=[]):array {
  $c=$this->credentials();$headers=['Authorization: Bearer '.$c['accessToken'],'X-Clover-Merchant-Id: '.$c['merchantId']];$mid=$this->id(['id'=>$c['merchantId']]);
  return match($operation){
   'merchant.get'=>$this->http('GET','https://apisandbox.dev.clover.com/v3/merchants/'.$mid,$headers),
   'checkout.create'=>$this->http('POST','https://apisandbox.dev.clover.com/invoicingcheckoutservice/v1/checkouts',$headers,$this->payload($arguments)),
   'payment.get'=>$this->http('GET','https://apisandbox.dev.clover.com/v3/merchants/'.$mid.'/payments/'.$this->id($arguments),$headers),
   default=>throw new \dyws\ApiError('Unsupported Clover operation.')};
 }
 public function verifyEvent(string $raw,array $headers):array {
  $parts=[];foreach(explode(',',$headers['HTTP_CLOVER_SIGNATURE']??'') as $p){$pair=explode('=',$p,2);if(count($pair)===2)$parts[trim($pair[0])]=trim($pair[1]);}
  $t=$parts['t']??'';$this->timestamp($t);$this->signature($parts['v1']??'',hash_hmac('sha256',$t.'.'.$raw,$this->credentials()['webhookSecret']));$event=$this->event($raw);
  if(($event['merchantId']??$event['MerchantId']??'')!==$this->credentials()['merchantId'])throw new \dyws\ApiError('Webhook belongs to another merchant.',400);return $event;
 }
}
