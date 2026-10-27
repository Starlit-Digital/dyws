<?php
declare(strict_types=1);
namespace dyws\Plugins\Square;
final class Connector extends \dyws\Payments\Connector {
 protected function orderPayload(array $order,string $key):array {
  return ['idempotency_key'=>$key,'order'=>['location_id'=>$this->credentials()['locationId'],'reference_id'=>$order['id'],'pricing_options'=>['auto_apply_taxes'=>false,'auto_apply_discounts'=>false],'line_items'=>array_map(fn($line)=>['name'=>$line['name'],'quantity'=>'1','base_price_money'=>['amount'=>$line['amount'],'currency'=>$order['currency']]],self::charges($order))],'checkout_options'=>['allow_tipping'=>false]];
 }
 protected function connection():string{$r=$this->request('locations.list');$id=$this->credentials()['locationId'];foreach($r['locations']??[] as $l)if($l['id']===$id&&($l['status']??'')==='ACTIVE')return 'Sandbox token and active location verified.';throw new \dyws\ApiError('The configured Square location is not active or accessible.');}
 public function request(string $operation,array $arguments=[]):array {
  $c=$this->credentials();$base='https://connect.squareupsandbox.com/v2';$headers=['Authorization: Bearer '.$c['accessToken'],'Square-Version: 2026-09-16'];
  return match($operation){
   'locations.list'=>$this->http('GET',$base.'/locations',$headers),
   'checkout.create'=>$this->http('POST',$base.'/online-checkout/payment-links',$headers,$this->payload($arguments)),
   'payment.get'=>$this->http('GET',$base.'/payments/'.$this->id($arguments),$headers),
   'order.get'=>$this->http('GET',$base.'/orders/'.$this->id($arguments),$headers),
   default=>throw new \dyws\ApiError('Unsupported Square operation.')};
 }
 public function verifyEvent(string $raw,array $headers):array{$s=$this->credentials();$this->signature($headers['HTTP_X_SQUARE_HMACSHA256_SIGNATURE']??'',base64_encode(hash_hmac('sha256',$this->webhookUrl().$raw,$s['webhookSecret'],true)));return $this->event($raw);}
}
