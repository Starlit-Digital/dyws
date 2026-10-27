<?php
declare(strict_types=1);
namespace dyws\Plugins\Moneris;
final class Connector extends \dyws\Payments\Connector {
 protected function orderPayload(array $order,string $key):array {
  return ['txn_total'=>self::decimal((int)$order['total']),'order_no'=>$order['id']];
 }
 protected function connection():string{
  $r=$this->request('checkout.create',['payload'=>['txn_total'=>'1.00']]);
  if(!in_array($r['response']['success']??false,[true,'true'],true)||empty($r['response']['ticket']))throw new \dyws\ApiError('Moneris did not accept the sandbox preload. Check the test store, token and checkout configuration.');
  return 'Sandbox preload accepted. A temporary $1.00 checkout session was created; no card was submitted or charged.';
 }
 public function request(string $operation,array $arguments=[]):array {
  $c=$this->credentials();$body=['store_id'=>$c['storeId'],'api_token'=>$c['apiToken'],'checkout_id'=>$c['checkoutId'],'environment'=>'qa'];
  if($operation==='checkout.create'){$p=$this->payload($arguments);unset($p['store_id'],$p['api_token'],$p['checkout_id'],$p['environment'],$p['action']);$body+=['action'=>'preload']+$p;}
  elseif($operation==='receipt.get')$body+=['action'=>'receipt','ticket'=>rawurldecode($this->id($arguments))];
  else throw new \dyws\ApiError('Unsupported Moneris operation.');
  return $this->http('POST','https://gatewayt.moneris.com/chktv2/request/request.php',[],$body);
 }
}
