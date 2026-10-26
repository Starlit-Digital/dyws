<?php
declare(strict_types=1);
require __DIR__.'/../modules/dyws/php/module.php';
use dyws\{Settings,ApiError};
$dir=sys_get_temp_dir().'/dyws-settings-'.bin2hex(random_bytes(6));mkdir($dir,0700);$checks=0;
function check($ok,$message){global $checks;if(!$ok)throw new RuntimeException($message);$checks++;}
function denied(callable $fn,int $code=422){try{$fn();throw new RuntimeException('Expected rejection');}catch(ApiError $e){check($e->http===$code,'Unexpected error '.$e->getMessage());}}
try {
 $config=['database'=>$dir.'/orders.sqlite','tenant'=>'example'];$settings=new Settings($config);$initial=$settings->summary();
 check($initial['settings']['driverRole']===['singular'=>'Driver','plural'=>'Drivers'],'Defaults');
 check(glob($dir.'/*')===[],'Reads do not write defaults');
 $body=['settings'=>['driverRole'=>['singular'=>' Handler ','plural'=>'Handlers']],'revision'=>$initial['revision']];
 $saved=$settings->save($body);check($saved['settings']['driverRole']['singular']==='Handler','Trim and save');
 check((new Settings($config))->summary()===$saved,'Persists across requests');
 denied(fn()=>$settings->save($body),409);
 check((new Settings(array_replace($config,['tenant'=>'other'])))->summary()===$initial,'Tenant isolation');
 foreach(['','   ',str_repeat('a',61),"Bad\nName",['wrong']] as $invalid){$body['settings']['driverRole']['singular']=$invalid;$body['revision']=$saved['revision'];denied(fn()=>$settings->save($body));}
 $body['settings']['driverRole']=['singular'=>'助理','plural'=>'Équipe'];$saved=$settings->save($body);check($saved['settings']['driverRole']['singular']==='助理','Unicode names');
 $body['revision']=$saved['revision'];$body['settings']['driverRole']=['singular'=>'<Admin & Handler>','plural'=>'Team'];$body['settings']['manager_password_hash']='must not persist';$saved=$settings->save($body);
 check(count($saved['settings'])===3,'Only supported business settings persisted');
 check($saved['settings']['driverRole']['singular']==='<Admin & Handler>','Plain text labels retained');
 $path=glob($dir.'/settings-*.json')[0];check((fileperms($path)&0777)===0600,'Settings file is private');
 check($saved['settings']['timeZone']==='America/Edmonton','Legacy settings default to Edmonton');
 check(in_array('UTC',$saved['timeZones'],true)&&in_array('Asia/Tokyo',$saved['timeZones'],true),'Timezone choices');
 $body=['settings'=>array_replace($saved['settings'],['timeZone'=>'Asia/Tokyo']),'revision'=>$saved['revision']];
 $saved=$settings->save($body);check($settings->read()['timeZone']==='Asia/Tokyo','Timezone persists');
 $body['revision']=$saved['revision'];unset($body['settings']['timeZone']);$saved=$settings->save($body);check($saved['settings']['timeZone']==='Asia/Tokyo','Old clients preserve selected timezone');
 foreach(['GMT+5','Not/AZone',[],null] as $zone){$body['revision']=$saved['revision'];$body['settings']['timeZone']=$zone;denied(fn()=>$settings->save($body));}
 echo "General settings: $checks checks passed.\n";
}finally{foreach(glob($dir.'/*') as $file)unlink($file);rmdir($dir);}
