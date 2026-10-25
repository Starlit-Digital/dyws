<?php
declare(strict_types=1);
namespace dyws\Plugins\AuthorizeNet;
final class Connector extends \dyws\Payments\Connector {
 protected function connection():string{$r=$this->request('account.verify');if(($r['messages']['resultCode']??'')!=='Ok')throw new \dyws\ApiError('Authorize.net did not accept the sandbox credentials.');return 'Sandbox merchant credentials accepted.';}
 public function request(string $operation,array $arguments=[]):array {
  $c=$this->credentials();$auth=['merchantAuthentication'=>['name'=>$c['loginId'],'transactionKey'=>$c['transactionKey']]];
  [$key,$body]=match($operation){
   'account.verify'=>['authenticateTestRequest',$auth],
   'checkout.create'=>['getHostedPaymentPageRequest',$auth+$this->payload($arguments)],
   'transaction.get'=>['getTransactionDetailsRequest',$auth+['transId'=>rawurldecode($this->id($arguments))]],
   default=>throw new \dyws\ApiError('Unsupported Authorize.net operation.')};
  return $this->http('POST','https://apitest.authorize.net/xml/v1/request.api',[],[$key=>$body]);
 }
 public function verifyEvent(string $raw,array $headers):array {
  $key=$this->credentials()['signatureKey'];if(!ctype_xdigit($key)||strlen($key)!==128)throw new \dyws\ApiError('Use the 128 character Authorize.net signature key.',400);
  $this->signature(strtolower($headers['HTTP_X_ANET_SIGNATURE']??''),'sha512='.hash_hmac('sha512',$raw,hex2bin($key)));return $this->event($raw);
 }
}
