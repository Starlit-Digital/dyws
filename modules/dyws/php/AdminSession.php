<?php
declare(strict_types=1);

/** Browser page access uses the same revocable, tenant scoped sessions as the API. */
function dyws_admin_base(array $config):string {
 return rtrim(parse_url($config['public_base_url']??'',PHP_URL_PATH)?:'','/');
}
function dyws_admin_cookie(array $config,string $name,string $value,int $expires):void {
 setcookie($name,$value,['expires'=>$expires,'path'=>dyws_admin_base($config).'/',
  'secure'=>parse_url($config['public_base_url']??'',PHP_URL_SCHEME)==='https'||(!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off'),
  'httponly'=>true,'samesite'=>'Lax']);
}
function dyws_admin_session(\dyws\Store $store):?string {
 $token=$_COOKIE['dyws_admin_session']??'';
 if(!is_string($token)||!preg_match('/^[a-f0-9]{64}$/D',$token))return null;
 $found=$store->query("SELECT 1 FROM sessions WHERE token_hash=? AND tenant=? AND role='manager' AND expires_at>?",[hash('sha256',$token),$store->tenant,time()]);
 return $found?$token:null;
}
function dyws_admin_redirect(array $config,string $page,int $status=302):never {
 header('Location: '.dyws_admin_base($config).'/'.$page.'/'.(($_GET['diagnostics']??'')==='1'?'?diagnostics=1':''),true,$status);exit;
}
function dyws_require_admin(array $config,\dyws\Store $store):string {
 $token=dyws_admin_session($store);
 if(!$token){dyws_admin_cookie($config,'dyws_admin_session','',time()-3600);dyws_admin_redirect($config,'auth');}
 header('Server-Timing: app;dur='.round((microtime(true)-($_SERVER['REQUEST_TIME_FLOAT']??microtime(true)))*1000,2));
 return $token;
}
function dyws_admin_meta(array $config,string $token):string {
 // The authenticated browser client also needs its bearer token for WebSocket RPC.
 return '<meta name="dyws-admin-token" content="'.htmlspecialchars($token,ENT_QUOTES,'UTF-8').'"><meta name="dyws-auth-url" content="'.htmlspecialchars(dyws_admin_base($config).'/auth/',ENT_QUOTES,'UTF-8').'">';
}
function dyws_admin_auth(array $config,\dyws\Store $store):array {
 if(dyws_admin_session($store))dyws_admin_redirect($config,'orders');
 $error='';
 if(($_SERVER['REQUEST_METHOD']??'GET')==='POST'){
  try{
   $cookie=$_COOKIE['dyws_auth_csrf']??'';$csrf=$_POST['csrf']??'';
   if((int)($_SERVER['CONTENT_LENGTH']??0)>4096)throw new \dyws\ApiError('Sign in form is too large.',413);
   if(!is_string($cookie)||!preg_match('/^[a-f0-9]{64}$/D',$cookie)||!is_string($csrf)||!hash_equals($cookie,$csrf))throw new \dyws\ApiError('Refresh this page and try again.',403);
   dyws_limit_requests($store,$config,'login',10,900);
   $session=(new \dyws\AdminAccounts($config))->login($store,['role'=>'manager','username'=>$_POST['username']??'','password'=>$_POST['password']??'']);
   dyws_admin_cookie($config,'dyws_admin_session',$session['token'],$session['expiresAt']);
   dyws_admin_cookie($config,'dyws_auth_csrf','',time()-3600);
   dyws_admin_redirect($config,'orders',303);
  }catch(\dyws\ApiError $e){http_response_code($e->http);$error=$e->getMessage();}
 }
 $csrf=bin2hex(random_bytes(32));dyws_admin_cookie($config,'dyws_auth_csrf',$csrf,0);
 return ['error'=>$error,'csrf'=>$csrf];
}

/** Plain text plugin presentation only. The page escapes every displayed value. */
function dyws_page_presentation(array $config,\dyws\Store $store,string $page):array {
 $plugins=$store->plugins??new \dyws\Plugins($config,$config['plugins_path']??null,$store);
 return $plugins->applyFilters('page.presentation',['notice'=>'','username'=>'','driverId'=>'demo-driver','gpsMessage'=>''],$page);
}
