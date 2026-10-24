<?php
declare(strict_types=1);
require __DIR__.'/../modules/dyws/php/module.php';
use dyws\{AdminAccounts,Store,Catalog,ApiError};
$dir=sys_get_temp_dir().'/dyws-accounts-'.bin2hex(random_bytes(6));mkdir($dir,0700);$checks=0;
function check($ok,$message){global $checks;if(!$ok)throw new RuntimeException($message);$checks++;}
function denied(callable $fn,int $code=422){try{$fn();throw new RuntimeException('Expected rejection');}catch(ApiError $e){check($e->http===$code,'Unexpected error '.$e->getMessage());}}
try{
 $catalog=Catalog::load(__DIR__.'/../examples/general-store/catalog.json');
 $config=['database'=>$dir.'/orders.sqlite','tenant'=>'test-shop','tracking_secret'=>str_repeat('x',40),'manager_password_hash'=>password_hash('original-manager-password',PASSWORD_DEFAULT),'drivers'=>['original'=>['name'=>'Original Driver','password_hash'=>password_hash('original-driver-password',PASSWORD_DEFAULT)]]];
 $GLOBALS['dyws_config']=$config;$store=new Store($config['database'],$catalog,$config['tenant']);$accounts=new AdminAccounts($config);
 $summary=$accounts->summary($store);check($summary['drivers'][0]['active']===true,'Existing drivers remain active');check(!str_contains(json_encode($summary),'password'),'Summary has no credentials');
 $driver=['id'=>'new-driver','name'=>'New Driver','active'=>true,'password'=>'new-driver-password','revision'=>$summary['revision']];
 $summary=$accounts->saveDriver($store,$driver);check(count($summary['drivers'])===2,'Driver persisted');
 denied(fn()=>$accounts->saveDriver($store,$driver),409);
 denied(fn()=>$accounts->saveDriver($store,array_replace($driver,['create'=>true,'revision'=>$summary['revision']])),409);
 $session=$accounts->login($store,['role'=>'driver','driverId'=>'new-driver','password'=>'new-driver-password']);check($session['role']==='driver','New driver can sign in');
 $driver['revision']=$summary['revision'];$driver['password']='replacement-driver-password';$summary=$accounts->saveDriver($store,$driver);
 check(!$store->query('SELECT * FROM sessions WHERE token_hash=?',[hash('sha256',$session['token'])]),'Password reset revokes driver sessions');
 denied(fn()=>$accounts->login($store,['role'=>'driver','driverId'=>'new-driver','password'=>'new-driver-password']),401);
 $session=$accounts->login($store,['role'=>'driver','driverId'=>'new-driver','password'=>'replacement-driver-password']);
 $driver['revision']=$summary['revision'];$driver['password']='';$driver['active']=false;$summary=$accounts->saveDriver($store,$driver);
 denied(fn()=>$accounts->login($store,['role'=>'driver','driverId'=>'new-driver','password'=>'replacement-driver-password']),401);
 check(!$store->query('SELECT * FROM sessions WHERE token_hash=?',[hash('sha256',$session['token'])]),'Deactivation revokes sessions');
 $order=$store->create(['idempotencyKey'=>bin2hex(random_bytes(16)),'customer'=>['name'=>'Example','phone'=>'7805550142'],'lines'=>[['id'=>'notebook','variant'=>'','quantity'=>1]],'fulfillment'=>'delivery','address'=>'Fictional address']);
 denied(fn()=>$accounts->assign($store,$order['id'],'new-driver'));
 $accounts->assign($store,$order['id'],'original');
 check($store->tracking($order['id'],$order['trackingToken'])['driver']===['name'=>'Original Driver','vehicleType'=>'','vehicleColor'=>''],'Tracking uses assigned driver name with optional empty vehicle fields');
 $summary=$accounts->saveDriver($store,['id'=>'original','name'=>'Alex <Morgan>','active'=>true,'password'=>'','vehicleType'=>'Sedan','vehicleColor'=>'Blue','revision'=>$summary['revision']]);
 $public=$store->tracking($order['id'],$order['trackingToken'])['driver'];check($public===['name'=>'Alex <Morgan>','vehicleType'=>'Sedan','vehicleColor'=>'Blue'],'Tracking exposes only driver display fields');
 check((new AdminAccounts($config))->effective()['drivers']['original']['vehicleType']==='Sedan','Vehicle persists across requests');
 foreach(['vehicleType','vehicleColor'] as $field)denied(fn()=>$accounts->saveDriver($store,['id'=>'original','name'=>'Alex','active'=>true,'password'=>'',$field=>str_repeat('x',61),'revision'=>$summary['revision']]));
 $summary=$accounts->saveDriver($store,['id'=>'original','name'=>'Alex <Morgan>','active'=>true,'password'=>'','revision'=>$summary['revision']]);check($store->tracking($order['id'],$order['trackingToken'])['driver']['vehicleColor']==='Blue','Omitted vehicle values are preserved');
 denied(fn()=>$store->tracking($order['id'],'wrong-token'),404);
 $store->execute("INSERT INTO drivers(tenant,id,name,password_hash,active,vehicle_type,vehicle_color) VALUES('other','original','Other Driver','private',1,'Van','Red')");check($store->tracking($order['id'],$order['trackingToken'])['driver']['name']==='Alex <Morgan>','Driver lookup remains tenant scoped');
 $pickup=$store->create(['idempotencyKey'=>bin2hex(random_bytes(16)),'customer'=>['name'=>'Example','phone'=>'7805550142'],'lines'=>[['id'=>'notebook','quantity'=>1]],'fulfillment'=>'pickup']);check($store->tracking($pickup['id'],$pickup['trackingToken'])['driver']===null,'Pickup has no driver profile');

 denied(fn()=>$accounts->saveDriver($store,['id'=>'original','name'=>'Original Driver','active'=>false,'password'=>'','revision'=>$summary['revision']]),409);
 denied(fn()=>$accounts->saveDriver($store,['id'=>'short','name'=>'Invalid','active'=>true,'password'=>'short','revision'=>$summary['revision']]));
 $manager=$accounts->login($store,['role'=>'manager','password'=>'original-manager-password']);
 denied(fn()=>$accounts->changePassword($store,['currentPassword'=>'wrong','newPassword'=>'replacement-manager-password','confirmPassword'=>'replacement-manager-password']));
 denied(fn()=>$accounts->changePassword($store,['currentPassword'=>'original-manager-password','newPassword'=>'replacement-manager-password','confirmPassword'=>'different']));
 $accounts->changePassword($store,['currentPassword'=>'original-manager-password','newPassword'=>'replacement-manager-password','confirmPassword'=>'replacement-manager-password']);
 check(!$store->query('SELECT * FROM sessions WHERE token_hash=?',[hash('sha256',$manager['token'])]),'Admin password change revokes all manager sessions');
 denied(fn()=>$accounts->login($store,['role'=>'manager','password'=>'original-manager-password']),401);
 check($accounts->login($store,['role'=>'manager','password'=>'replacement-manager-password'])['role']==='manager','Changed admin password works');
 $fresh=new AdminAccounts($config);check(password_verify('replacement-manager-password',$fresh->effective()['manager_password_hash']),'Account override survives a new request');
 $path=$config['database'];$saved=file_get_contents($path);check(!str_contains($saved,'replacement-manager-password')&&!str_contains($saved,'replacement-driver-password'),'Passwords stored only as hashes');
 check((fileperms($path)&0777)===0600,'Database file is private');
 check(!glob($dir.'/accounts-*.json'),'New account writes do not create JSON credentials');
 check(count($store->query('SELECT * FROM drivers WHERE tenant=?',[$config['tenant']]))===2,'Drivers stored in SQLite');
 // A separate tenant imports overrides once and never resurrects stale config credentials.
 $legacy=array_replace($config,['tenant'=>'legacy']);
 $legacyPath=$dir.'/accounts-'.substr(hash('sha256','legacy'),0,16).'.json';
 Catalog::write($legacyPath,['manager_password_hash'=>password_hash('legacy-admin-password',PASSWORD_DEFAULT),'drivers'=>['original'=>['name'=>'Renamed','active'=>false,'password_hash'=>password_hash('legacy-driver-password',PASSWORD_DEFAULT)]]]);
 $migration=new AdminAccounts($legacy);$effective=$migration->effective();
 check($effective['drivers']['original']['name']==='Renamed'&&!$effective['drivers']['original']['active'],'Legacy name and inactive status imported');
 check(password_verify('legacy-admin-password',$effective['manager_password_hash']),'Legacy admin override preserved');
 check(password_verify('legacy-driver-password',$effective['drivers']['original']['password_hash']),'Legacy driver password preserved');
 Catalog::write($legacyPath,['drivers'=>['ghost'=>['name'=>'Stale','password_hash'=>'ignored']]]);
 check(!isset((new AdminAccounts($legacy))->effective()['drivers']['ghost']),'Migration does not replay stale JSON');
 check(password_verify('replacement-manager-password',(new AdminAccounts($config))->effective()['manager_password_hash']),'Migration is tenant scoped');
 echo "Admin accounts: $checks checks passed.\n";
}finally{unset($store);foreach(glob($dir.'/*')as $file)unlink($file);rmdir($dir);}
