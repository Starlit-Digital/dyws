<?php
// Explicit CLI opt-in only. Creates a NEW isolated installation, never converts existing data.
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
umask(0077);
require_once __DIR__.'/../../server/bootstrap.php';
require_once __DIR__.'/DemoPolicy.php';
use dyws\Plugins\DemoLockdown\DemoPolicy;
$dir=$argv[1]??'';$url=rtrim($argv[2]??'','/');
if(!$dir||!filter_var($url,FILTER_VALIDATE_URL)||!in_array(parse_url($url,PHP_URL_SCHEME),['http','https'],true))throw new RuntimeException('Usage: php plugins/demo-lockdown/setup.php NEW_PRIVATE_DIRECTORY PUBLIC_URL');
if(file_exists($dir))throw new RuntimeException('Destination exists. Use a new private directory; existing data is never changed.');
if(!mkdir($dir,0700,true))throw new RuntimeException('Cannot create private directory.');$dir=realpath($dir);
$base=dirname(__DIR__,2);copy($base.'/examples/starlit-diner/catalog.json',$dir.'/catalog.json');
$config=['public_base_url'=>$url,'tenant'=>'dyws-public-demo','catalog'=>$dir.'/catalog.json','database'=>$dir.'/dyws.sqlite','tracking_secret'=>bin2hex(random_bytes(32)), 'demo_lockdown'=>true,'required_plugins'=>['demo-lockdown'],'driver_test_location'=>DemoPolicy::LOCATION,'manager_password_hash'=>password_hash('admin',PASSWORD_DEFAULT),'drivers'=>['driver'=>['name'=>'Demo Driver','password_hash'=>password_hash('driver',PASSWORD_DEFAULT),'active'=>true]]];
$effective=(new \dyws\AdminAccounts($config))->effective();$config['demo_account_fingerprint']=DemoPolicy::accountFingerprint($effective);unset($config['manager_password_hash'],$config['drivers']);
\dyws\Catalog::write($dir.'/plugins-'.substr(hash('sha256',$config['tenant']),0,16).'.json',['active'=>['demo-lockdown','order-reporting','datatables'],'known'=>['demo-lockdown','google-maps','stripe','order-reporting','datatables'],'requirements'=>['demo-lockdown'=>['validation']]]);
\dyws\Catalog::write($dir.'/config.json',$config);
[$config,$store]=dyws_bootstrap($dir.'/config.json');
for($i=0;$i<3;$i++){
 $receipt=$store->create(['idempotencyKey'=>bin2hex(random_bytes(16)),'fulfillment'=>$i===2?'pickup':'delivery','lines'=>[['id'=>'breakfast0','variant'=>'','quantity'=>$i+1]]]);
 $id=$receipt['id'];$store->payment($id,'capture');
 foreach(['accepted','preparing','ready'] as $status)$store->change($id,$status,'manager');
 if($i===2)$store->change($id,'completed','manager');else $store->assign($id,'driver');
}
file_put_contents($dir.'/installed.lock',gmdate(DATE_ATOM));
echo "Created isolated public demo. Admin: admin / admin. Driver: driver / driver.\n";
