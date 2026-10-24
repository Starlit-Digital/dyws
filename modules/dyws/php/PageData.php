<?php
declare(strict_types=1);

/** Page credentials are checked before building any private initial state. */
function dyws_driver_session(\dyws\Store $store):?array {
 $token=$_COOKIE['dyws_driver_session']??'';
 if(!is_string($token)||!preg_match('/^[a-f0-9]{64}$/D',$token))return null;
 $rows=$store->query("SELECT * FROM sessions WHERE token_hash=? AND tenant=? AND role='driver' AND expires_at>?",[hash('sha256',$token),$store->tenant,time()]);
 return $rows?['token'=>$token]+$rows[0]:null;
}
function dyws_driver_auth(array $config,\dyws\Store $store):array {
 $session=dyws_driver_session($store);if($session)return ['session'=>$session,'error'=>'','csrf'=>''];
 $error='';
 if(($_SERVER['REQUEST_METHOD']??'GET')==='POST')try{
  $cookie=$_COOKIE['dyws_driver_csrf']??'';$csrf=$_POST['csrf']??'';
  if((int)($_SERVER['CONTENT_LENGTH']??0)>4096)throw new \dyws\ApiError('Sign in form is too large.',413);
  if(!is_string($cookie)||!preg_match('/^[a-f0-9]{64}$/D',$cookie)||!is_string($csrf)||!hash_equals($cookie,$csrf))throw new \dyws\ApiError('Refresh this page and try again.',403);
  dyws_limit_requests($store,$config,'login',10,900);
  $login=(new \dyws\AdminAccounts($config))->login($store,['role'=>'driver','driverId'=>$_POST['driverId']??'','password'=>$_POST['password']??'']);
  dyws_admin_cookie($config,'dyws_driver_session',$login['token'],$login['expiresAt']);dyws_admin_cookie($config,'dyws_driver_csrf','',time()-3600);
  dyws_admin_redirect($config,'driver',303);
 }catch(\dyws\ApiError $e){http_response_code($e->http);$error=$e->getMessage();}
 $csrf=bin2hex(random_bytes(32));dyws_admin_cookie($config,'dyws_driver_csrf',$csrf,0);
 return ['session'=>null,'error'=>$error,'csrf'=>$csrf];
}
function dyws_driver_orders(array $config,\dyws\Store $store,array $session):array {
 if(isset($config['driver_test_location']))foreach($store->orders($session['subject']) as $order)if($order['status']==='out_for_delivery'&&!$order['deliveryRun'])$store->testLocation($order['id'],$session,$config['driver_test_location']);
 return ['orders'=>$store->orders($session['subject']),'runs'=>(new \dyws\DeliveryRuns($store))->listing($session['subject'])];
}
function dyws_tracking_access(array $config,\dyws\Store $store):?array {
 $post=($_SERVER['REQUEST_METHOD']??'GET')==='POST';$id=$post?($_POST['orderId']??''):($_GET['order']??'');
 if(!$post&&$id==='')return null;
 if((int)($_SERVER['CONTENT_LENGTH']??0)>4096)throw new \dyws\ApiError('Tracking request is too large.',413);
 if(!is_string($id)||!preg_match('/^[A-Z]{2,7}-[A-F0-9]{12}$/D',$id))throw new \dyws\ApiError('This tracking link is unavailable or has expired.',404);
 $name='dyws_track_'.$id;$token=$post?($_POST['trackingToken']??''):($_COOKIE[$name]??'');
 if(!is_string($token)||!preg_match('/^[a-f0-9]{64}$/D',$token))throw new \dyws\ApiError('This tracking link is unavailable or has expired.',404);
 dyws_limit_requests($store,$config,'tracking',120,60);$data=$store->tracking($id,$token);
 if($post){
  // The private fragment is handed off in a POST body, never in a request URL.
  setcookie($name,$token,['expires'=>0,'path'=>dyws_admin_base($config).'/tracking/','secure'=>parse_url($config['public_base_url']??'',PHP_URL_SCHEME)==='https'||(!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off'),'httponly'=>true,'samesite'=>'Lax']);
  header('Location: '.dyws_admin_base($config).'/tracking/?order='.rawurlencode($id).(($_GET['diagnostics']??'')==='1'?'&diagnostics=1':''),true,303);exit;
 }
 return ['id'=>$id,'token'=>$token,'data'=>$data];
}
function dyws_page_data(array $config,\dyws\Store $store,string $page,array $access):array {
 $started=microtime(true);$plugins=new \dyws\Plugins($config,$config['plugins_path']??null,$store);$store->plugins=$plugins;
 $boot=['page'=>$page,'responses'=>['/settings'=>(new \dyws\Settings($config))->read(),'/plugins'=>$plugins->publicManifest($page)],'realtime'=>(new \dyws\Realtime($config,$store))->publicConfig()];
 if($page==='driver'){
  $boot['driverToken']=$access['token'];$boot['responses']['/driver/orders']=dyws_driver_orders($config,$store,$access);$boot['responses']['/driver/gps-config']=['testLocation'=>$config['driver_test_location']??null];
 }elseif($page==='tracking'){
  $boot['tracking']=['id'=>$access['id'],'token'=>$access['token']];$boot['responses']['/tracking/'.$access['id']]=$plugins->applyFilters('tracking.public',$access['data']);
 }
 if($page==='storefront')$boot['responses']['/catalog']=$plugins->applyFilters('catalog.public',\dyws\Catalog::publicData(\dyws\Catalog::load($config['catalog'])));
 $route='/plugins/google-maps/config';$matched=$plugins->match('GET',$route);
 if(in_array('location.renderer',\dyws\PageManifest::forPage($page)['requires'],true)&&$matched&&$matched['access']==='public')try{$boot['responses'][$route]=($matched['handler'])([],null,['raw'=>'','params'=>$matched['params'],'server'=>$_SERVER]);}catch(\Throwable $e){/* The map provides its own fallback. */}
 foreach($boot['responses'] as $route=>$data)$boot['responses'][$route]=$plugins->applyFilters('api.response',$data,$route,'GET');
 header('Server-Timing: app;dur='.round((microtime(true)-($_SERVER['REQUEST_TIME_FLOAT']??microtime(true)))*1000,2).', initial_data;dur='.round((microtime(true)-$started)*1000,2));return $boot;
}
function dyws_page_initial_head(array $boot,string $publicRoot,string $prefix='../'):string {
 return str_replace('name="dyws-admin-data"','name="dyws-page-data"',dyws_admin_initial_head($boot,$publicRoot,$prefix));
}
function dyws_loading_skeleton(string $label='Loading controls'):string {
 return '<div class="dyws-skeleton" data-dyws-skeleton role="status" aria-label="'.htmlspecialchars($label,ENT_QUOTES,'UTF-8').'"><span class="dyws-visually-hidden">'.htmlspecialchars($label,ENT_QUOTES,'UTF-8').'…</span><i></i><i></i><i></i></div>';
}
function dyws_driver_preview(array $boot):string {
 $escape=static fn($v)=>htmlspecialchars((string)$v,ENT_QUOTES,'UTF-8');$html='';
 foreach($boot['responses']['/driver/orders']['orders'] as $order)$html.='<article><h2>'.$escape($order['id']).'</h2><p>'.$escape(ucfirst(str_replace('_',' ',$order['status']))).' · '.$escape($order['currency']).' '.number_format($order['total']/100,2).'</p><p>'.$escape($order['customer_name']).' · '.$escape($order['customer_phone']).'<br>'.$escape($order['address']).'</p><p>'.$escape($order['notes']).'</p></article>';
 return $html?:'<p>No active deliveries. You’re all caught up.</p>';
}
function dyws_tracking_preview(array $boot):string {
 $order=$boot['responses']['/tracking/'.$boot['tracking']['id']];$escape=static fn($v)=>htmlspecialchars((string)$v,ENT_QUOTES,'UTF-8');
 $titles=['placed'=>'Order received','accepted'=>'Order accepted','preparing'=>'Preparing your order','ready'=>$order['fulfillment']==='pickup'?'Ready for pickup':'Ready for delivery','out_for_delivery'=>$boot['responses']['/settings']['driverRole']['singular'].' is on the way','delivered'=>'Delivered','completed'=>'Collected','cancelled'=>'Order cancelled'];
 $terminal=in_array($order['status'],['delivered','completed','cancelled'],true);
 $driver=$order['driver']??null;$driverHtml=$driver?'<div class="dyws-tracking-driver"><p class="dyws-driver-label">'.$escape($boot['responses']['/settings']['driverRole']['singular']).'</p><strong>'.$escape($driver['name']).'</strong><p>'.$escape(implode(' · ',array_filter([$driver['vehicleColor'],$driver['vehicleType']]))).'</p></div>':'';
 return '<section data-dyws-initial-preview class="dyws-tracking-panel"><p class="dyws-tracking-reference">Order <strong>'.$escape($order['id']).'</strong></p><h2>'.$escape($titles[$order['status']]??'Order update').'</h2><p>Payment: '.$escape(ucfirst($order['paymentStatus'])).'</p>'.$driverHtml.($terminal?'<p>'.($order['status']==='cancelled'?'This order has been cancelled.':'Your order is complete. No further action is needed.').'</p>':'<p>'.($order['status']==='out_for_delivery'?'Your delivery is on the way. Loading the latest location.':'Order updates appear here automatically.').'</p>').'</section>';
}
