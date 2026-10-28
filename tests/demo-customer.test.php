<?php
declare(strict_types=1);
require __DIR__.'/../modules/dyws/php/module.php';
require __DIR__.'/../plugins/demo-lockdown/DemoPolicy.php';
use dyws\{Store,ApiError};
use dyws\Plugins\DemoLockdown\DemoPolicy;
$path=tempnam(sys_get_temp_dir(),'dyws-demo-customer-');$checks=0;
$GLOBALS['dyws_config']=['tracking_secret'=>str_repeat('a',64)];
$catalog=json_decode(file_get_contents(__DIR__.'/../examples/starlit-diner/catalog.json'),true);
function check($ok,$message){global $checks;if(!$ok)throw new RuntimeException($message);$checks++;}
try{
 $s=new Store($path,$catalog);$policy=new DemoPolicy([],$s);
 $body=['idempotencyKey'=>bin2hex(random_bytes(16)),'customer'=>['name'=>'Jordan Taylor','phone'=>'7805550142','email'=>'jordan@example.test'],'fulfillment'=>'delivery','addressDetails'=>DemoPolicy::ADDRESS,'lines'=>[['id'=>'breakfast0','quantity'=>1]]];
 $legacy=$s->create($body);$before=$s->get($legacy['id']);
 check($s->create($policy->orderInput($body))===$legacy,'Earlier demo order retries keep the original receipt');
 $changed=$body;$changed['lines'][0]['quantity']=2;
 try{$s->create($policy->orderInput($changed));throw new RuntimeException('Changed request accepted');}catch(ApiError $e){check($e->http===409,'Different lines still reject replay');}
 $input=$body;$input['idempotencyKey']=bin2hex(random_bytes(16));$input['customer']=['name'=>'Private Person','phone'=>'7805550199','email'=>'discard@example.test'];
 $clean=$policy->orderInput($input);$new=$s->get($s->create($clean)['id']);
 check($new['customer_name']==='Demo Customer'&&$new['customer_email']==='demo.customer@example.test','New demo orders always use current fictional contact');
 check($policy->response(['orders'=>[$before]],'/manager/orders','GET')['orders'][0]['customer_name']==='Demo Customer','Legacy manager and driver presentation uses Demo Customer');
 check($policy->response(['orders'=>[$before]],'/driver/orders','GET')['orders'][0]['customer_email']==='demo.customer@example.test','Legacy fictional email presentation is consistent');
 $guest=$policy->response(['customer'=>['name'=>'Jordan Taylor','email'=>'jordan@example.test']],'/guest-details','GET');check($guest['customer']===['name'=>'Demo Customer','email'=>'demo.customer@example.test'],'Remembered demo presentation uses current contact');
 check($s->get($legacy['id'])===$before,'Presentation never rewrites original receipts or fingerprints');
 $withoutEmail=$body;unset($withoutEmail['customer']['email']);$withoutEmail['idempotencyKey']=bin2hex(random_bytes(16));$old=$s->create($withoutEmail);check($s->create($policy->orderInput($withoutEmail))===$old,'Pre email demo orders remain idempotent');
 $other=new Store($path,$catalog,'another-store');$otherPolicy=new DemoPolicy([],$other);check($otherPolicy->orderInput($body)['customer']['name']==='Demo Customer','A different tenant cannot reuse an earlier tenant contact');
 echo "Demo customer identity: $checks checks passed.\n";
}finally{unset($s,$other,$policy,$otherPolicy);foreach([$path,$path.'-wal',$path.'-shm'] as $f)if(is_file($f))unlink($f);}
