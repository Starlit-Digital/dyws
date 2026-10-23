<?php
declare(strict_types=1);
use StarlitGo\{PluginContext,ApiError,Store};
use StarlitGo\Plugins\Stripe\{StripeSettings,StripePayments};
require_once __DIR__.'/StripeSettings.php';
require_once __DIR__.'/StripePayments.php';
return static function(PluginContext $plugin):void {
 $settings=new StripeSettings($plugin->config);
 $payments=static function()use($plugin,$settings):StripePayments {
  if(!$plugin->store)throw new ApiError('Payment storage is unavailable.',503);
  return new StripePayments($plugin->store,$plugin->config,$settings);
 };
 $plugin->providePayment(fn()=>$settings->read()['enabled']?'stripe':null);
 foreach(['/manager/plugins/stripe/settings','/manager/stripe'] as $path){
  $plugin->route('GET',$path,'manager',fn()=>$settings->summary());
  $plugin->route('POST',$path,'manager',fn($body)=>$settings->save($body),['rateLimit'=>['payment-settings',30,900]]);
 }
 foreach(['/manager/plugins/stripe/verify','/manager/stripe/verify'] as $path)$plugin->route('POST',$path,'manager',fn()=>$payments()->verifyConnection(),['rateLimit'=>['stripe-verify',10,900]]);
 foreach(['/plugins/stripe/webhook','/stripe/webhook'] as $path)$plugin->route('POST',$path,'public',fn($body,$session,$request)=>$payments()->webhook($request['raw'],$request['server']['HTTP_STRIPE_SIGNATURE']??''),['maxBody'=>262144]);
 foreach(['/plugins/stripe/orders/{orderId}/checkout','/orders/{orderId}/checkout'] as $path)$plugin->route('POST',$path,'public',static function($body,$session,$request)use($payments):array{
  $id=$request['params']['orderId'];if(!preg_match('/^SG-[A-F0-9]{12}$/D',$id))throw new ApiError('Order not found.',404);
  return $payments()->checkout($id,$request['server']['HTTP_X_TRACKING_TOKEN']??'');
 },['rateLimit'=>['checkout',20,900]]);
};
