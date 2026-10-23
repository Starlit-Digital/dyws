<?php
declare(strict_types=1);
function dyws_serve_api(?string $configPath=null,?callable $bootstrap=null):void {
ini_set('display_errors','0');
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');header('Referrer-Policy: no-referrer');
try {
 [$config,$store]=$bootstrap?$bootstrap():dyws_bootstrap($configPath);
 $accounts=new \StarlitGo\AdminAccounts($config);
 $stripeSettings=new \StarlitGo\StripeSettings($config);$stripe=new \StarlitGo\StripePayments($store,$config,$stripeSettings);
 $method=$_SERVER['REQUEST_METHOD'];$route=$_GET['route']??'/health';if(!is_string($route)||strlen($route)>180)throw new \StarlitGo\ApiError('Invalid route.',400);
 if($method==='POST'){
  $maxBody=$route==='/manager/catalog'?262144:($route==='/stripe/webhook'?262144:32768);
  if(stripos($_SERVER['CONTENT_TYPE']??'','application/json')!==0)throw new \StarlitGo\ApiError('JSON requests are required.',415);
  if((int)($_SERVER['CONTENT_LENGTH']??0)>$maxBody)throw new \StarlitGo\ApiError('Request is too large.',413);
  $raw=file_get_contents('php://input',false,null,0,$maxBody+1);if(strlen($raw)>$maxBody)throw new \StarlitGo\ApiError('Request is too large.',413);
  $body=json_decode($raw,true,64,JSON_THROW_ON_ERROR);if(!is_array($body))throw new \StarlitGo\ApiError('Invalid request.',400);
 }else $body=[];
 $result=null;
 if($method==='GET'&&$route==='/health')$result=['service'=>'Starlit Go','demo'=>true];
 elseif($method==='GET'&&$route==='/catalog')$result=\StarlitGo\Catalog::publicData(\StarlitGo\Catalog::load($config['catalog']));
 elseif($method==='GET'&&$route==='/manager/catalog'){dyws_authorize($store,['manager']);$catalog=\StarlitGo\Catalog::load($config['catalog']);$result=['catalog'=>$catalog,'revision'=>\StarlitGo\Catalog::revision($catalog)];}
 elseif($method==='POST'&&$route==='/manager/catalog'){dyws_authorize($store,['manager']);if(!is_array($body['catalog']??null))throw new \StarlitGo\ApiError('Provide a catalog object.');$catalog=\StarlitGo\Catalog::save($config['catalog'],$body['catalog'],\StarlitGo\Store::text($body['revision']??null,64));$result=['catalog'=>$catalog,'revision'=>\StarlitGo\Catalog::revision($catalog)];}
 elseif($method==='GET'&&$route==='/manager/drivers'){dyws_authorize($store,['manager']);$result=$accounts->summary($store);}
 elseif($method==='POST'&&$route==='/manager/drivers'){dyws_authorize($store,['manager']);dyws_limit_requests($store,$config,'driver-settings',30,900);$result=$accounts->saveDriver($store,$body);}
 elseif($method==='POST'&&$route==='/manager/password'){dyws_authorize($store,['manager']);dyws_limit_requests($store,$config,'manager-password',10,900);$result=$accounts->changePassword($store,$body);}
 elseif($method==='GET'&&$route==='/manager/stripe'){dyws_authorize($store,['manager']);$result=$stripeSettings->summary();}
 elseif($method==='POST'&&$route==='/manager/stripe'){dyws_authorize($store,['manager']);$result=$stripeSettings->save($body);}
 elseif($method==='POST'&&$route==='/manager/stripe/verify'){dyws_authorize($store,['manager']);dyws_limit_requests($store,$config,'stripe-verify',10,900);$result=$stripe->verifyConnection();}
 elseif($method==='POST'&&$route==='/stripe/webhook')$result=$stripe->webhook($raw,$_SERVER['HTTP_STRIPE_SIGNATURE']??'');
 elseif($method==='POST'&&preg_match('~^/orders/(SG-[A-F0-9]{12})/checkout$~',$route,$m)){dyws_limit_requests($store,$config,'checkout',20,900);$result=$stripe->checkout($m[1],$_SERVER['HTTP_X_TRACKING_TOKEN']??'');}
 elseif($method==='POST'&&$route==='/login'){
  dyws_limit_requests($store,$config,'login',10,900);
  $result=$accounts->login($store,$body);
 }
 elseif($method==='POST'&&$route==='/logout'){$s=dyws_authorize($store,['manager','driver']);$store->execute('DELETE FROM sessions WHERE token_hash=?',[$s['token_hash']]);$result=['ok'=>true];}
 elseif($method==='POST'&&$route==='/orders'){dyws_limit_requests($store,$config,'orders',20,3600);if(($body['demoAcknowledged']??false)!==true)throw new \StarlitGo\ApiError('Confirm this is a test order.');$result=$store->create($body);http_response_code(201);}
 elseif($method==='GET'&&preg_match('~^/tracking/(SG-[A-F0-9]{12})$~',$route,$m)){dyws_limit_requests($store,$config,'tracking',120,60);$result=$store->tracking($m[1],$_SERVER['HTTP_X_TRACKING_TOKEN']??'');}
 elseif($method==='GET'&&$route==='/manager/orders'){dyws_authorize($store,['manager']);$result=['orders'=>$store->orders(),'drivers'=>array_map(fn($id,$d)=>['id'=>$id,'name'=>$d['name']],array_keys(array_filter($config['drivers'],fn($d)=>$d['active']??true)),array_values(array_filter($config['drivers'],fn($d)=>$d['active']??true)))];}
 elseif($method==='GET'&&$route==='/manager/reports'){
  dyws_authorize($store,['manager']);$tz=new DateTimeZone('America/Edmonton');$start=$_GET['from']??date('Y-m-d');$end=$_GET['to']??$start;
  $from=DateTimeImmutable::createFromFormat('!Y-m-d',$start,$tz);$to=DateTimeImmutable::createFromFormat('!Y-m-d',$end,$tz);if(!$from||!$to||$from->format('Y-m-d')!==$start||$to->format('Y-m-d')!==$end||$to<$from||$to->getTimestamp()-$from->getTimestamp()>366*86400)throw new \StarlitGo\ApiError('Choose a valid date range up to one year.');$result=$store->reports($from->getTimestamp(),$to->modify('+1 day')->getTimestamp());
 }
 elseif($method==='POST'&&preg_match('~^/manager/orders/(SG-[A-F0-9]{12})/(status|assign|payment)$~',$route,$m)){
  dyws_authorize($store,['manager']);if($m[2]==='status')$result=$store->change($m[1],\StarlitGo\Store::text($body['status']??null,30),'manager');
  elseif($m[2]==='assign'){$driver=$body['driverId']??'';if(!is_string($driver))throw new \StarlitGo\ApiError('Unknown driver.');$accounts->assign($store,$m[1],$driver);$result=['ok'=>true];}
  else{$store->payment($m[1],\StarlitGo\Store::text($body['kind']??null,20));$result=['ok'=>true];}
 }
 elseif($method==='GET'&&$route==='/driver/orders'){$s=dyws_authorize($store,['driver']);$result=['orders'=>$store->orders($s['subject'])];}
 elseif($method==='POST'&&preg_match('~^/driver/orders/(SG-[A-F0-9]{12})/(status|location)$~',$route,$m)){
  $s=dyws_authorize($store,['driver']);if($m[2]==='status')$result=$store->change($m[1],\StarlitGo\Store::text($body['status']??null,30),'driver:'.$s['subject'],$s['subject']);else{dyws_limit_requests($store,$config,'gps',120,60);$store->locate($m[1],$s['subject'],$body);$result=['ok'=>true];}
 }else throw new \StarlitGo\ApiError('Endpoint not found.',404);
 echo json_encode($result,JSON_THROW_ON_ERROR|JSON_UNESCAPED_SLASHES);
}catch(\StarlitGo\ApiError $e){http_response_code($e->http);echo json_encode(['error'=>$e->getMessage()]);}
catch(JsonException $e){http_response_code(400);echo json_encode(['error'=>'Invalid JSON request.']);}
catch(Throwable $e){error_log('Starlit Go API failure: '.$e->getMessage());http_response_code(500);echo json_encode(['error'=>'The order service is temporarily unavailable.']);}

}
 function dyws_limit_requests($store,$config,string $name,int $max,int $seconds):void{
  $bucket=hash_hmac('sha256',$name.'|'.($_SERVER['REMOTE_ADDR']??'local').'|'.intdiv(time(),$seconds),$config['tracking_secret']);
  $store->transaction(function()use($store,$bucket,$max,$seconds){$r=$store->query('SELECT hits FROM limits WHERE bucket=?',[$bucket]);if($r&&(int)$r[0]['hits']>=$max)throw new \StarlitGo\ApiError('Please wait before trying again.',429);$store->execute('INSERT INTO limits(bucket,hits,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET hits=hits+1',[$bucket,time()+$seconds]);$store->execute('DELETE FROM limits WHERE expires_at<?',[time()]);});
 }
 function dyws_authorize($store,array $roles):array{
  $authorization=$_SERVER['HTTP_AUTHORIZATION']??'';if(!preg_match('/^Bearer ([a-f0-9]{64})$/',$authorization,$m))throw new \StarlitGo\ApiError('Please sign in.',401);
  $rows=$store->query('SELECT * FROM sessions WHERE token_hash=? AND tenant=? AND expires_at>?',[hash('sha256',$m[1]),$store->tenant,time()]);
  if(!$rows)throw new \StarlitGo\ApiError('Your session expired. Sign in again.',401);$session=$rows[0];if(!in_array($session['role'],$roles,true))throw new \StarlitGo\ApiError('Access denied.',403);return $session;
 }
