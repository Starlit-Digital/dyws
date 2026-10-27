<?php
declare(strict_types=1);
require __DIR__.'/../modules/dyws/php/module.php';
require_once __DIR__.'/../modules/dyws/php/AdminData.php';
use dyws\{Store,ApiError,GuestDetails,CustomerDrivers};
$path=tempnam(sys_get_temp_dir(),'dyws-email-');$checks=0;
$GLOBALS['dyws_config']=['tracking_secret'=>str_repeat('a',64)];
$catalog=json_decode(file_get_contents(__DIR__.'/../examples/starlit-diner/catalog.json'),true);
function check($ok,$message){global $checks;if(!$ok)throw new RuntimeException($message);$checks++;}
function rejects($fn,$status){try{$fn();throw new RuntimeException('Expected rejection');}catch(ApiError $e){check($e->http===$status,$e->getMessage());}}
function body($email=null){$b=['idempotencyKey'=>bin2hex(random_bytes(16)),'customer'=>['name'=>'Fictional Guest','phone'=>'7805550142'],'lines'=>[['id'=>'breakfast0','quantity'=>1]],'fulfillment'=>'delivery','address'=>'123 Fictional Road'];if($email!==null)$b['customer']['email']=$email;return $b;}
try{
 $s=new Store($path,$catalog,'alpha');$s->db->exec(file_get_contents(__DIR__.'/../modules/dyws/php/accounts.sql'));
 $old=body();$legacy=$s->create($old);check($s->get($legacy['id'])['customer_email']==='','Old clients can omit email');
 $blank=$old;$blank['customer']['email']='';check($s->create($blank)===$legacy,'Blank email preserves existing request fingerprint and receipt');
 foreach(['bad-email',"valid@example.test\r\nBcc: other@example.test",str_repeat('a',255).'@example.test',['email'=>'not a string']] as $bad)rejects(fn()=>$s->create(body($bad)),422);
 $s->execute('INSERT INTO customers VALUES(?,?,?,?,?)',['alpha','CUS-ONE','one@example.test',time(),time()]);
 $request=body(' ONE@EXAMPLE.TEST ');$receipt=$s->create($request);$guest=$s->get($receipt['id']);
 check($guest['customer_email']==='one@example.test'&&$guest['customer_id']===null,'Guest email normalizes without claiming account ownership');
 check($s->query('SELECT * FROM customer_delivery_addresses')===[],'Guest email never creates account address pairs');
 $request['customer']['email']='one@example.test';check($s->create($request)===$receipt,'Equivalent email retry is idempotent');
 $request['customer']['email']='two@example.test';rejects(fn()=>$s->create($request),409);
 $s->execute('INSERT INTO customer_driver_blocks VALUES(?,?,?,?,?)',['alpha','CUS-ONE','driver-one',$legacy['id'],time()]);
 check(!CustomerDrivers::blocked($s,$guest,'driver-one'),'An unverified email does not inherit an account block');
 $signed=$s->get($s->create(body(),'demo','CUS-ONE')['id']);check($signed['customer_email']==='one@example.test'&&$signed['customer_id']==='CUS-ONE','Session derives trusted contact email for older clients');
 check(CustomerDrivers::blocked($s,$signed,'driver-one'),'Verified account still carries driver blocks');
 $exact=$s->get($s->create(body('ONE@example.test'),'demo','CUS-ONE')['id']);check($exact['customer_email']==='one@example.test','Verified email accepts normalized equivalent');
 rejects(fn()=>$s->create(body('two@example.test'),'demo','CUS-ONE'),409);
 $other=new Store($path,$catalog,'beta');rejects(fn()=>$other->create(body(),'demo','CUS-ONE'),401);
 check(!array_key_exists('customer_email',$s->safeOrder($guest))&&!str_contains(json_encode($s->tracking($receipt['id'],$receipt['trackingToken'])),'one@example.test'),'Driver and tracking projections omit email');
 $admin=dyws_admin_orders(['drivers'=>[]],$s);$listed=array_values(array_filter($admin['orders'],fn($o)=>$o['id']===$guest['id']))[0];check($listed['customer_email']==='one@example.test'&&!isset($listed['customer_id']),'Only manager order projection includes contact email');
 $details=new GuestDetails($s,['public_base_url'=>'http://localhost']);$s->transaction(fn()=>$details->ordered($guest,['enabled'=>true,'profileId'=>'','addressId'=>'','label'=>'Home','default'=>false]));
 check($s->query('SELECT customer_email FROM guest_details')[0]['customer_email']==='one@example.test','Existing remember consent saves email privately');
 $s->execute('UPDATE guest_details SET expires_at=1');$details->prune();check($s->query('SELECT * FROM guest_details')===[],'Expired remembered email is deleted');
 check($s->query('PRAGMA integrity_check')[0]['integrity_check']==='ok'&&$s->query('PRAGMA foreign_key_check')===[],'Email migration preserves database integrity');
 echo "Checkout email: $checks checks passed.\n";
}finally{unset($s,$other,$details);foreach([$path,$path.'-wal',$path.'-shm'] as $f)if(is_file($f))unlink($f);}
