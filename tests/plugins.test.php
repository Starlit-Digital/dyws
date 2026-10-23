<?php
declare(strict_types=1);
require __DIR__.'/../modules/dyws/php/module.php';
use StarlitGo\{Plugins,ApiError};
$work=sys_get_temp_dir().'/dyws-plugins-'.bin2hex(random_bytes(5));mkdir($work,0700);mkdir($work.'/plugins');mkdir($work.'/plugins/sample');$checks=0;
function check($value,$label){global $checks;if(!$value)throw new RuntimeException($label);$checks++;}
function denied($fn,$status){try{$fn();throw new RuntimeException('Expected error');}catch(ApiError $e){check($e->http===$status,'Expected status');}}
function writePlugin($directory,$id,$code){mkdir($directory.'/'.$id);file_put_contents($directory.'/'.$id.'/plugin.json',json_encode(['id'=>$id,'name'=>$id,'description'=>'Test plugin','version'=>'1.0.0','apiVersion'=>1,'entry'=>'plugin.php']));file_put_contents($directory.'/'.$id.'/plugin.php',$code);}
try{
 $config=['database'=>$work.'/orders.sqlite','tenant'=>'alpha'];$root=$work.'/plugins';rmdir($root.'/sample');
 writePlugin($root,'sample', <<<'PHP'
<?php
return function($plugin){
 $plugin->route('GET','/plugins/sample/hello','public',fn()=>['message'=>'Hello']);
 $plugin->route('GET','/manager/plugins/sample/private','manager',fn()=>['private'=>true]);
 $plugin->addFilter('test',fn($value)=>[...$value,2],20);
 $plugin->addFilter('test',fn($value)=>[...$value,1],10);
 $plugin->addAction('test',function(){$GLOBALS['plugin_action']=true;});
 $plugin->onActivate(function(){$GLOBALS['plugin_activated']=true;});
 $plugin->onDeactivate(function(){$GLOBALS['plugin_deactivated']=true;});
};
PHP);
 $plugins=new Plugins($config,$root);$initial=$plugins->summary();check(count($initial['plugins'])===1,'Discovery');check($plugins->publicManifest()['plugins']===[],'New plugins are inactive');check($plugins->match('GET','/plugins/sample/hello')===null,'Inactive routes unavailable');
 $saved=$plugins->save(['id'=>'sample','active'=>true,'revision'=>$initial['revision']]);check($GLOBALS['plugin_activated']===true,'Activation hook');check($saved['plugins'][0]['active'],'Activated');
 check(($plugins->match('GET','/plugins/sample/hello')['handler'])([])===['message'=>'Hello'],'Route registered');check($plugins->match('GET','/manager/plugins/sample/private')['access']==='manager','Manager authority declared');check($plugins->applyFilters('test',[])===[1,2],'Ordered filters');$plugins->doAction('test');check($GLOBALS['plugin_action']===true,'Action hook');
 denied(fn()=>$plugins->save(['id'=>'sample','active'=>false,'revision'=>$initial['revision']]),409);
 check((new Plugins(array_replace($config,['tenant'=>'beta']),$root))->publicManifest()['plugins']===[],'Tenant isolation');
 $plugins->save(['id'=>'sample','active'=>false,'revision'=>$saved['revision']]);check($GLOBALS['plugin_deactivated']===true,'Deactivation hook');check($plugins->publicManifest()['plugins']===[],'Deactivated manifest');check($plugins->match('GET','/plugins/sample/hello')===null,'Deactivated routes');
 check((fileperms(glob($work.'/plugins-*.json')[0])&0777)===0600,'Private JSON permissions');
 writePlugin($root,'broken','<?php return function($plugin){throw new RuntimeException("Fixture error");};');
 $plugins=new Plugins($config,$root);denied(fn()=>$plugins->save(['id'=>'broken','active'=>true,'revision'=>$plugins->summary()['revision']]),409);check($plugins->publicManifest()['plugins']===[],'Failed activation not saved');
 writePlugin($root,'unsafe',"<?php return function(\$plugin){\$plugin->route('GET','/manager/plugins/unsafe/secret','public',fn()=>[]);};");
 $plugins=new Plugins($config,$root);denied(fn()=>$plugins->save(['id'=>'unsafe','active'=>true,'revision'=>$plugins->summary()['revision']]),409);
 writePlugin($root,'collision',"<?php return function(\$plugin){\$plugin->route('GET','/login','public',fn()=>[]);};");
 $plugins=new Plugins($config,$root);denied(fn()=>$plugins->save(['id'=>'collision','active'=>true,'revision'=>$plugins->summary()['revision']]),409);
 file_put_contents($root.'/bundled.json',json_encode(['active'=>['broken']]));$other=new Plugins(array_replace($config,['tenant'=>'other']),$root);check($other->publicManifest()['plugins']===[],'Broken bundled plugin isolated');check($other->summary()['plugins'][0]['name']!==null,'Admin remains accessible');
 file_put_contents(glob($work.'/plugins-*.json')[0],'{broken');$plugins=new Plugins($config,$root);check($plugins->publicManifest()['plugins']===[],'Corrupt state fails closed');check($plugins->summary()['warning']!==null,'Corrupt state explained to manager');
 file_put_contents($root.'/sample/plugin.json','{"id":"sample","apiVersion":99}');check(count((new Plugins($config,$root))->summary()['plugins'])===4,'Invalid manifest reported without breaking discovery');
 $missing=new Plugins($config,$work.'/missing');check($missing->publicManifest()['plugins']===[],'Missing plugin directory does not break core');
 echo "Plugins: $checks checks passed.\n";
}finally{
 $files=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($work,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST);foreach($files as $file){if($file->isDir())rmdir($file->getPathname());else unlink($file->getPathname());}rmdir($work);
}
