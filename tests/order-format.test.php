<?php
declare(strict_types=1);
require __DIR__.'/../modules/dyws/php/module.php';
require __DIR__.'/../plugins/order-format/Templates.php';
use dyws\Plugins\OrderFormat\Templates;
use dyws\{ApiError,Plugins};
$work=sys_get_temp_dir().'/dyws-order-format-'.bin2hex(random_bytes(5));mkdir($work,0700);$config=['database'=>$work.'/orders.sqlite','tenant'=>'alpha','tracking_secret'=>str_repeat('a',64)];$checks=0;
function check($value,string $message){global $checks;if(!$value)throw new RuntimeException($message);$checks++;}
function denied(callable $fn,int $status=422){try{$fn();throw new RuntimeException('Expected rejection');}catch(ApiError $e){check($e->http===$status,'Status: '.$e->getMessage());}}
function template(string $stage,string $id):array{$fields=[];$row=0;foreach(Templates::schema()[$stage]['fields'] as $field)if(!($field['extra']??false))$fields[]=['id'=>$field['id'],'row'=>++$row,'column'=>1,'span'=>2,'align'=>'left','vertical'=>'top'];return ['id'=>$id,'name'=>'Sample '.$stage,'stage'=>$stage,'layout'=>['rows'=>$row,'fields'=>$fields]];}
try{
 $service=new Templates($config);$initial=$service->summary();check($initial['templates']===[]&&$service->layouts()===['layouts'=>[]],'Fresh plugin uses built in defaults');
 $body=['templates'=>[template('cart','cart-a'),template('checkout','checkout-a'),template('review','review-a')],'assignments'=>['cart'=>null,'checkout'=>null,'review'=>null],'revision'=>$initial['revision']];
 $saved=$service->save($body);check(count($saved['templates'])===3,'Drafts saved');check($service->layouts()===['layouts'=>[]],'Drafts are not published');
 $body['revision']=$saved['revision'];$body['assignments']['review']='review-a';$saved=$service->save($body);check(isset($service->layouts()['layouts']['review']),'Stage assigned');
 denied(fn()=>$service->save($body),409);$body['revision']=$saved['revision'];
 $wrong=$body;$wrong['assignments']['checkout']='review-a';denied(fn()=>$service->save($wrong));
 $wrong=$body;$wrong['templates'][2]['layout']['fields']=array_values(array_filter($wrong['templates'][2]['layout']['fields'],fn($f)=>$f['id']!=='actions'));denied(fn()=>$service->save($wrong));
 $wrong=$body;$wrong['templates'][0]['layout']['fields'][1]['row']=1;denied(fn()=>$service->save($wrong));
 $wrong=$body;$wrong['templates'][0]['layout']['fields'][0]['align']='left;position:fixed';denied(fn()=>$service->save($wrong));
 $other=new Templates($config+[]);check($other->summary()['revision']===$saved['revision'],'Persistent settings');
 $other=new Templates(array_replace($config,['tenant'=>'beta']));check($other->layouts()===['layouts'=>[]],'Tenant isolation');
 $plugins=new Plugins($config);$state=$plugins->save(['id'=>'order-format','active'=>true,'revision'=>$plugins->summary()['revision']]);check($plugins->match('GET','/plugins/order-format/layouts')!==null,'Active public layout endpoint');check($plugins->match('POST','/manager/plugins/order-format/templates')['access']==='manager','Writes need manager role');
 $plugins->save(['id'=>'order-format','active'=>false,'revision'=>$state['revision']]);check($plugins->match('GET','/plugins/order-format/layouts')===null,'Disabled plugin removes layout provider route');check($service->summary()['revision']===$saved['revision'],'Disabling preserves templates');
 $file=glob($work.'/order-format-*.json')[0];check((fileperms($file)&0777)===0600,'Private template permissions');file_put_contents($file,'{broken');check($service->layouts()===['layouts'=>[]],'Corrupt settings restore fallback');denied(fn()=>$service->summary(),503);
 echo "Order Format: $checks checks passed.\n";
}finally{foreach(glob($work.'/*') as $file)unlink($file);rmdir($work);}
