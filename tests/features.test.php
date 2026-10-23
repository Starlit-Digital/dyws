<?php
declare(strict_types=1);
require __DIR__.'/../modules/dyws/php/module.php';
use dyws\{Plugins,PageManifest,Provides,Requires};
$work=sys_get_temp_dir().'/dyws-features-'.bin2hex(random_bytes(5));mkdir($work,0700);$checks=0;
function check($value){global $checks;if(!$value)throw new RuntimeException('Feature check '.($checks+1).' failed.');$checks++;}
try{
 foreach(['storefront','orders','reports','catalog','drivers','password','settings','plugins','driver','tracking','auth','admin','setup'] as $page)check(PageManifest::forPage($page)['page']===$page);
 try{PageManifest::forPage('../orders');check(false);}catch(InvalidArgumentException){check(true);}
 try{new Provides('https://invalid.test/plugin.js');check(false);}catch(InvalidArgumentException){check(true);}
 $fixtures=['maps'=>['location.renderer'],'tables'=>['admin:tables'],'navigation'=>['admin:navigation'],'global'=>null,'validator'=>['checkout:validating']];
 foreach($fixtures as $id=>$provides){mkdir($work.'/'.$id);file_put_contents($work.'/'.$id.'/plugin.json',json_encode(['id'=>$id,'name'=>$id,'description'=>'Fixture','version'=>'1.0.0','apiVersion'=>1,'entry'=>'plugin.php','browserModule'=>'index.js','capabilities'=>$id==='validator'?['validation']:[]]));
  $attr=$provides===null?'':'#[\\dyws\\Provides('.implode(',',array_map(fn($n)=>var_export($n,true),$provides)).')] ';
  file_put_contents($work.'/'.$id.'/plugin.php','<?php return '.$attr.'static function($p){$p->route("GET","/plugins/'.$id.'/test","public",fn()=>["ok"=>true]);};');
 }
 file_put_contents($work.'/bundled.json',json_encode(['active'=>array_keys($fixtures)]));$plugins=new Plugins(['tenant'=>'fixture','database'=>$work.'/orders.sqlite'],$work);
 $driver=$plugins->publicManifest('driver');check(array_column($driver['plugins'],'id')===['maps','global','validator']);check($driver['requires']===['location.renderer','driver:orders']);check($driver['plugins'][0]['provides']===['location.renderer']);
 check(array_column($plugins->publicManifest('password')['plugins'],'id')===['navigation','global','validator']);
 check(array_column($plugins->publicManifest('reports')['plugins'],'id')===['tables','navigation','global','validator']);
 check(count($plugins->publicManifest()['plugins'])===5);
 check($plugins->match('GET','/plugins/tables/test')!==null); // Browser filtering must never disable server hooks/routes.
 $plugins->save(['id'=>'maps','active'=>false,'revision'=>$plugins->summary()['revision']]);check(!in_array('maps',array_column($plugins->publicManifest('driver')['plugins'],'id'),true));
 echo "PHP feature manifests: $checks checks passed.\n";
}finally{foreach(new RecursiveIteratorIterator(new RecursiveDirectoryIterator($work,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST)as $p)$p->isDir()?rmdir($p->getPathname()):unlink($p->getPathname());rmdir($work);}
