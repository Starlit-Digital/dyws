<?php
declare(strict_types=1);
require __DIR__.'/../modules/dyws/php/module.php';
require __DIR__.'/../modules/dyws/php/MapsSettings.php';
use dyws\{MapsSettings,ApiError};
$dir=sys_get_temp_dir().'/dyws-maps-'.bin2hex(random_bytes(6));mkdir($dir,0700);$checks=0;
function check($ok,$message){global $checks;if(!$ok)throw new RuntimeException($message);$checks++;}
function denied(callable $fn,int $code=422){try{$fn();throw new RuntimeException('Expected rejection');}catch(ApiError $e){check($e->http===$code,'Unexpected error '.$e->getMessage());}}
try{
 $config=['database'=>$dir.'/orders.sqlite','tenant'=>'example'];$maps=new MapsSettings($config);$initial=$maps->summary();check(!$initial['enabled']&&!$initial['hasKey'],'Disabled by default');check($maps->publicConfig()['browserKey']==='','No key exposure when disabled');
 $body=['revision'=>$initial['revision'],'enabled'=>true,'browserKey'=>'','mapId'=>'DEMO_MAP_ID'];denied(fn()=>$maps->save($body));
 $body['browserKey']=str_repeat('a',39);$saved=$maps->save($body);check($saved['hasKey']&&!isset($saved['browserKey']),'Admin summary redacts key');check($maps->publicConfig()['browserKey']===$body['browserKey'],'Enabled browser key available to map SDK');denied(fn()=>$maps->save($body),409);
 $body['revision']=$saved['revision'];$body['browserKey']='';$body['enabled']=false;$saved=$maps->save($body);check($saved['hasKey']&&$maps->publicConfig()['browserKey']==='','Disable hides public key and retains configuration');
 check((new MapsSettings(array_replace($config,['tenant'=>'other'])))->summary()===$initial,'Tenant scoped');check((new MapsSettings($config))->summary()===$saved,'Persisted');check((fileperms(glob($dir.'/maps-*.json')[0])&0777)===0600,'Private file permissions');
 $body['revision']=$saved['revision'];$body['mapId']='bad<script>';denied(fn()=>$maps->save($body));
 echo "Maps settings: $checks checks passed.\n";
}finally{foreach(glob($dir.'/*')as $file)unlink($file);rmdir($dir);}
