<?php
declare(strict_types=1);
require_once __DIR__.'/Plugins.php';
function dyws_serve_api(?string $configPath=null,?callable $bootstrap=null):void {
ini_set('display_errors','0');
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');header('Referrer-Policy: no-referrer');
try {
 [$config,$store]=$bootstrap?$bootstrap():dyws_bootstrap($configPath);
 $plugins=new \dyws\Plugins($config,$config['plugins_path']??null,$store);$store->plugins=$plugins;
 $realtime=new \dyws\Realtime($config,$store);
 $expired=$store->pruneLocations();if($expired)$realtime->changed(array_merge([$store->tenant.':operators'],array_map(fn($id)=>$store->tenant.':order:'.$id,$expired)));
 $accounts=new \dyws\AdminAccounts($config);
 $method=$_SERVER['REQUEST_METHOD'];$route=$_GET['route']??'/health';if(!is_string($route)||strlen($route)>180)throw new \dyws\ApiError('Invalid route.',400);
 $pluginRoute=$plugins->match($method,$route);$raw='';
 if($method==='POST'){
  $maxBody=$route==='/manager/catalog'?262144:($pluginRoute['maxBody']??32768);
  if(stripos($_SERVER['CONTENT_TYPE']??'','application/json')!==0)throw new \dyws\ApiError('JSON requests are required.',415);
  if((int)($_SERVER['CONTENT_LENGTH']??0)>$maxBody)throw new \dyws\ApiError('Request is too large.',413);
  $raw=file_get_contents('php://input',false,null,0,$maxBody+1);if(strlen($raw)>$maxBody)throw new \dyws\ApiError('Request is too large.',413);
  $body=json_decode($raw,true,64,JSON_THROW_ON_ERROR);if(!is_array($body))throw new \dyws\ApiError('Invalid request.',400);
 }else $body=[];
 if(!empty($config['required_plugins']))$plugins->validate('request.validating',$method,$route,$body);
 $result=null;
 if($method==='GET'&&$route==='/health')$result=['service'=>'dyws','demo'=>true];
 elseif($method==='GET'&&$route==='/realtime/config')$result=$realtime->publicConfig();
 elseif($method==='POST'&&$route==='/realtime/access'){
  $scope=$body['scope']??'public';$session=null;$order=null;
  if($scope==='operator')$session=dyws_authorize($store,['manager','driver']);
  elseif($scope==='tracking'){$order=\dyws\Store::text($body['orderId']??null,20);$store->tracking($order,$_SERVER['HTTP_X_TRACKING_TOKEN']??'');}
  elseif($scope!=='public')throw new \dyws\ApiError('Invalid realtime scope.');
  $result=$realtime->access($scope,$session,$order);
 }
 elseif($method==='GET'&&$route==='/plugins')$result=$plugins->publicManifest();
 elseif($method==='GET'&&$route==='/manager/plugins'){dyws_authorize($store,['manager']);$result=$plugins->summary();}
 elseif($method==='POST'&&$route==='/manager/plugins'){dyws_authorize($store,['manager']);dyws_limit_requests($store,$config,'plugins',30,900);$result=$plugins->save($body);}
 elseif($method==='GET'&&$route==='/settings')$result=(new \dyws\Settings($config))->read();
 elseif($method==='GET'&&$route==='/manager/settings'){dyws_authorize($store,['manager']);$result=(new \dyws\Settings($config))->summary();}
 elseif($method==='POST'&&$route==='/manager/settings'){dyws_authorize($store,['manager']);$result=(new \dyws\Settings($config))->save($body);}
 elseif($method==='GET'&&$route==='/catalog')$result=$plugins->applyFilters('catalog.public',\dyws\Catalog::publicData(\dyws\Catalog::load($config['catalog'])));
 elseif($method==='GET'&&$route==='/manager/catalog'){dyws_authorize($store,['manager']);$catalog=\dyws\Catalog::load($config['catalog']);$result=['catalog'=>$catalog,'revision'=>\dyws\Catalog::revision($catalog)];}
 elseif($method==='POST'&&$route==='/manager/catalog'){dyws_authorize($store,['manager']);if(!is_array($body['catalog']??null))throw new \dyws\ApiError('Provide a catalog object.');$plugins->validate('catalog.validating',\dyws\Catalog::validate($body['catalog']));$catalog=\dyws\Catalog::save($config['catalog'],$body['catalog'],\dyws\Store::text($body['revision']??null,64));$result=['catalog'=>$catalog,'revision'=>\dyws\Catalog::revision($catalog)];}
 elseif($method==='GET'&&$route==='/manager/driver-locations'){dyws_authorize($store,['manager']);$result=['locations'=>array_map(fn($o)=>['driverId'=>$o['driver_id'],'orderId'=>$o['id'],'deliveryAddress'=>$o['address'],'gps'=>$store->locationSummary($o['id'])],$store->query("SELECT id,driver_id,address FROM orders WHERE tenant=? AND status='out_for_delivery' AND driver_id IS NOT NULL ORDER BY updated_at DESC",[$store->tenant]))];}
 elseif($method==='GET'&&$route==='/manager/drivers'){dyws_authorize($store,['manager']);$result=$accounts->summary($store);}
 elseif($method==='POST'&&$route==='/manager/drivers'){dyws_authorize($store,['manager']);dyws_limit_requests($store,$config,'driver-settings',30,900);$result=$accounts->saveDriver($store,$body);}
 elseif($method==='POST'&&$route==='/manager/password'){dyws_authorize($store,['manager']);dyws_limit_requests($store,$config,'manager-password',10,900);$result=$accounts->changePassword($store,$body);}
 elseif($method==='POST'&&$route==='/login'){
  dyws_limit_requests($store,$config,'login',10,900);
  $result=$accounts->login($store,$body);
 }
 elseif($method==='POST'&&$route==='/logout'){$s=dyws_authorize($store,['manager','driver']);dyws_admin_cookie($config,$s['role']==='manager'?'dyws_admin_session':'dyws_driver_session','',time()-3600);$store->execute('DELETE FROM sessions WHERE token_hash=?',[$s['token_hash']]);$expired=$store->pruneLocations();if($expired)$realtime->changed(array_map(fn($id)=>$store->tenant.':order:'.$id,$expired));$result=['ok'=>true];}
 elseif($method==='POST'&&$route==='/orders'){dyws_limit_requests($store,$config,'orders',20,3600);if(($body['demoAcknowledged']??false)!==true)throw new \dyws\ApiError('Confirm this is a test order.');$result=$store->create($body,$plugins->paymentProvider());http_response_code(201);}
 elseif($method==='GET'&&preg_match('~^/tracking/([A-Z]{2,7}-[A-F0-9]{12})$~',$route,$m)){dyws_limit_requests($store,$config,'tracking',120,60);$result=$plugins->applyFilters('tracking.public',$store->tracking($m[1],$_SERVER['HTTP_X_TRACKING_TOKEN']??''));}
 elseif($method==='GET'&&$route==='/manager/orders'){dyws_authorize($store,['manager']);$result=dyws_admin_orders($config,$store);}
 elseif($method==='GET'&&$route==='/manager/lookup'){
  dyws_authorize($store,['manager']);dyws_limit_requests($store,$config,'lookup',120,60);
  $query=\dyws\Store::text($_GET['q']??'',100);$kind=\dyws\Store::text($_GET['kind']??'all',60);
  $result=$plugins->applyFilters('lookup.results',\dyws\Lookup::search($store,\dyws\Catalog::load($config['catalog']),$config['drivers'],$query,$kind),['query'=>$query,'kind'=>$kind]);
 }
 elseif($method==='GET'&&$route==='/manager/reports'){
  dyws_authorize($store,['manager']);$result=dyws_admin_report($config,$store,$plugins,$_GET);
 }
 elseif($method==='POST'&&preg_match('~^/manager/orders/([A-Z]{2,7}-[A-F0-9]{12})/(status|assign|payment)$~',$route,$m)){
  dyws_authorize($store,['manager']);if($m[2]==='status')$result=$store->change($m[1],\dyws\Store::text($body['status']??null,30),'manager');
  elseif($m[2]==='assign'){$driver=$body['driverId']??'';if(!is_string($driver))throw new \dyws\ApiError('Unknown driver.');$accounts->assign($store,$m[1],$driver);$result=['ok'=>true];}
  else{$store->payment($m[1],\dyws\Store::text($body['kind']??null,20));$result=['ok'=>true];}
 }
 elseif($method==='POST'&&preg_match('~^/driver/orders/([A-Z]{2,7}-[A-F0-9]{12})/location/(start|stop|heartbeat)$~',$route,$m)){
  $s=dyws_authorize($store,['driver']);dyws_limit_requests($store,$config,'gps-control',60,60);
  if($m[2]==='start')$result=$store->startLocation($m[1],$s,isset($config['driver_test_location'])?'simulated':\dyws\Store::text($body['source']??'device',20));
  elseif($m[2]==='heartbeat'){$store->heartbeatLocation($m[1],$s,\dyws\Store::text($body['sharingToken']??null,64));$result=['ok'=>true];}
  else{$store->stopLocation($m[1],$s,\dyws\Store::text($body['sharingToken']??null,64));$result=['ok'=>true];}
 }
 elseif($method==='GET'&&$route==='/driver/gps-config'){dyws_authorize($store,['driver']);$result=['testLocation'=>$config['driver_test_location']??null];}
 elseif($method==='GET'&&$route==='/driver/orders'){$s=dyws_authorize($store,['driver']);$result=dyws_driver_orders($config,$store,$s);}
 elseif($method==='POST'&&preg_match('~^/driver/orders/([A-Z]{2,7}-[A-F0-9]{12})/(status|location)$~',$route,$m)){
  $s=dyws_authorize($store,['driver']);if($m[2]==='status')$result=$store->change($m[1],\dyws\Store::text($body['status']??null,30),'driver:'.$s['subject'],$s['subject']);else{dyws_limit_requests($store,$config,'gps',120,60);if(isset($config['driver_test_location'])){$body=array_replace($body,array_intersect_key($config['driver_test_location'],array_flip(['latitude','longitude','accuracy'])));}$store->locate($m[1],$s['subject'],$body,$s);$result=['ok'=>true,'recordedAt'=>$body['recordedAt'],'receivedAt'=>time()];}
 }elseif($pluginRoute){
  $session=$pluginRoute['access']==='public'?null:dyws_authorize($store,[$pluginRoute['access']]);
  if($pluginRoute['rateLimit'])dyws_limit_requests($store,$config,...$pluginRoute['rateLimit']);
  $result=($pluginRoute['handler'])($body,$session,['raw'=>$raw,'params'=>$pluginRoute['params'],'server'=>$_SERVER]);
 }else throw new \dyws\ApiError('Endpoint not found.',404);
 if($method==='POST'){
  $realtime->mutation($route,$result);
  if(isset($pluginRoute))$realtime->changed([$store->tenant.':public']);
  if($route==='/manager/catalog')$plugins->doAction('catalog.saved',$result['catalog'],$result['revision']);
  if(preg_match('~^/manager/orders/([A-Z]{2,7}-[A-F0-9]{12})/assign$~',$route,$assigned))$plugins->doAction('order.assigned',$store->safeOrder($store->get($assigned[1])));
  if($route==='/orders')$plugins->doAction('order.created',$result,$store);
  if(str_ends_with($route,'/status'))$plugins->doAction('order.status_changed',$result,$store);
 }
 header('X-DYWS-Time-Zone: '.(new \dyws\Settings($config))->read()['timeZone']);
 $result=$plugins->applyFilters('api.response',$result,$route,$method);
 $plugins->doAction('api.respond',$route,$method,$result);
 header('Server-Timing: app;dur='.round((microtime(true)-($_SERVER['REQUEST_TIME_FLOAT']??microtime(true)))*1000,2));
 echo json_encode($result,JSON_THROW_ON_ERROR|JSON_UNESCAPED_SLASHES);
}catch(\dyws\ApiError $e){http_response_code($e->http);echo json_encode(['error'=>$e->getMessage()]);}
catch(JsonException $e){http_response_code(400);echo json_encode(['error'=>'Invalid JSON request.']);}
catch(Throwable $e){error_log('dyws API failure: '.$e->getMessage());http_response_code(500);echo json_encode(['error'=>'The order service is temporarily unavailable.']);}

}
 function dyws_limit_requests($store,$config,string $name,int $max,int $seconds):void{
  $identity=$_SERVER['REMOTE_ADDR']??'local';$secret=$config['realtime']['secret']??'';if(strlen($secret)>=32&&hash_equals($secret,$_SERVER['HTTP_X_DYWS_RELAY_KEY']??'')&&preg_match('/^[a-f0-9]{64}$/',$_SERVER['HTTP_X_DYWS_CLIENT']??''))$identity=$_SERVER['HTTP_X_DYWS_CLIENT'];
  $bucket=hash_hmac('sha256',$name.'|'.$identity.'|'.intdiv(time(),$seconds),$config['tracking_secret']);
  $store->transaction(function()use($store,$bucket,$max,$seconds){$r=$store->query('SELECT hits FROM limits WHERE bucket=?',[$bucket]);if($r&&(int)$r[0]['hits']>=$max)throw new \dyws\ApiError('Please wait before trying again.',429);$store->execute('INSERT INTO limits(bucket,hits,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET hits=hits+1',[$bucket,time()+$seconds]);$store->execute('DELETE FROM limits WHERE expires_at<?',[time()]);});
 }
 function dyws_authorize($store,array $roles):array{
  $authorization=$_SERVER['HTTP_AUTHORIZATION']??'';if(!preg_match('/^Bearer ([a-f0-9]{64})$/',$authorization,$m))throw new \dyws\ApiError('Please sign in.',401);
  $rows=$store->query('SELECT * FROM sessions WHERE token_hash=? AND tenant=? AND expires_at>?',[hash('sha256',$m[1]),$store->tenant,time()]);
  if(!$rows)throw new \dyws\ApiError('Your session expired. Sign in again.',401);$session=$rows[0];if(!in_array($session['role'],$roles,true))throw new \dyws\ApiError('Access denied.',403);return $session;
 }
