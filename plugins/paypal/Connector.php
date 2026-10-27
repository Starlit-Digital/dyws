<?php
declare(strict_types=1);
namespace dyws\Plugins\PayPal;
final class Connector extends \dyws\Payments\Connector {
 private function token():string{$c=$this->credentials();$r=$this->http('POST','https://api-m.sandbox.paypal.com/v1/oauth2/token',['Authorization: Basic '.base64_encode($c['clientId'].':'.$c['clientSecret'])],['grant_type'=>'client_credentials'],true);if(!is_string($r['access_token']??null))throw new \dyws\ApiError('PayPal did not return an access token.',502);return $r['access_token'];}
 protected function orderPayload(array $order,string $key):array {
  $money=fn(int $cents)=>['currency_code'=>$order['currency'],'value'=>self::decimal($cents)];
  $items=[['name'=>'Order items','quantity'=>'1','unit_amount'=>$money((int)$order['subtotal'])]];
  if($order['tip']>0)$items[]=['name'=>'Tip','quantity'=>'1','unit_amount'=>$money((int)$order['tip'])];
  return ['intent'=>'CAPTURE','purchase_units'=>[['reference_id'=>$order['id'],'custom_id'=>$order['id'],'items'=>$items,'amount'=>$money((int)$order['total'])+['breakdown'=>['item_total'=>$money((int)$order['subtotal']+(int)$order['tip']),'tax_total'=>$money((int)$order['tax']),'shipping'=>$money((int)$order['delivery_fee'])]]]]];
 }
 protected function connection():string{$this->token();return 'Sandbox OAuth credentials accepted. Webhook delivery needs a sandbox event test.';}
 public function request(string $operation,array $arguments=[]):array {
  if($operation==='account.verify')return ['ok'=>$this->token()!==''];
  $base='https://api-m.sandbox.paypal.com/v2';$headers=['Authorization: Bearer '.$this->token()];
  if(in_array($operation,['checkout.create','order.capture'],true))$headers[]='PayPal-Request-Id: '.\dyws\Store::text($arguments['idempotencyKey']??null,108);
  return match($operation){
   'checkout.create'=>$this->http('POST',$base.'/checkout/orders',$headers,$this->payload($arguments)),
   'order.get'=>$this->http('GET',$base.'/checkout/orders/'.$this->id($arguments),$headers),
   'order.capture'=>$this->http('POST',$base.'/checkout/orders/'.$this->id($arguments).'/capture',$headers,[]),
   'capture.get'=>$this->http('GET',$base.'/payments/captures/'.$this->id($arguments),$headers),
   default=>throw new \dyws\ApiError('Unsupported PayPal operation.')};
 }
 public function verifyEvent(string $raw,array $headers):array {
  $event=$this->event($raw);$body=['webhook_id'=>$this->credentials()['webhookId'],'webhook_event'=>$event];
  foreach(['auth_algo'=>'HTTP_PAYPAL_AUTH_ALGO','cert_url'=>'HTTP_PAYPAL_CERT_URL','transmission_id'=>'HTTP_PAYPAL_TRANSMISSION_ID','transmission_sig'=>'HTTP_PAYPAL_TRANSMISSION_SIG','transmission_time'=>'HTTP_PAYPAL_TRANSMISSION_TIME'] as $key=>$header){if(empty($headers[$header]))throw new \dyws\ApiError('Missing PayPal signature.',400);$body[$key]=$headers[$header];}
  $result=$this->http('POST','https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature',['Authorization: Bearer '.$this->token()],$body);
  if(($result['verification_status']??'')!=='SUCCESS')throw new \dyws\ApiError('Invalid PayPal signature.',400);return $event;
 }
}
