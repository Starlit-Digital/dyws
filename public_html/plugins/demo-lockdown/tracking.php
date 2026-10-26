<?php
declare(strict_types=1);
require __DIR__.'/../../admin/bootstrap.php';

// This handoff is available only inside the mandatory, fictional public demo.
if(($config['demo_lockdown']??false)!==true||!in_array('demo-lockdown',$config['required_plugins']??[],true)||!in_array('demo-lockdown',$store->plugins->activeIds(),true)){
 http_response_code(404);exit('Not found.');
}
if(($_SERVER['REQUEST_METHOD']??'GET')!=='GET'){
 header('Allow: GET');http_response_code(405);exit('Use the customer tracking link in Admin orders.');
}
dyws_require_admin($config,$store);
try{
 $id=$_GET['order']??'';
 if(!is_string($id))throw new \dyws\ApiError('This tracking link is unavailable or has expired.',404);
 dyws_limit_requests($store,$config,'demo-tracking-preview',120,60);
 $token=(new \dyws\Plugins\DemoLockdown\DemoPolicy($config,$store))->trackingAccess($id);
 // Match the customer's existing order scoped cookie. No token is placed in a URL or response body.
 setcookie('dyws_track_'.$id,$token,['expires'=>0,'path'=>dyws_admin_base($config).'/tracking/',
  'secure'=>parse_url($config['public_base_url']??'',PHP_URL_SCHEME)==='https'||(!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off'),
  'httponly'=>true,'samesite'=>'Lax']);
 header('Location: '.dyws_admin_base($config).'/tracking/?order='.rawurlencode($id),true,303);exit;
}catch(\dyws\ApiError $e){
 http_response_code($e->http);header('Content-Type: text/plain; charset=utf-8');echo $e->getMessage();
}
