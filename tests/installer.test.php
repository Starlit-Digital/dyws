<?php
declare(strict_types=1);
require __DIR__.'/../modules/dyws/php/module.php';require __DIR__.'/../modules/dyws/php/Installer.php';
use dyws\{Installer,ApiError};
$base=sys_get_temp_dir().'/dyws-install-core-'.bin2hex(random_bytes(6));mkdir($base,0700);mkdir($base.'/var',0700);mkdir($base.'/public',0700);mkdir($base.'/public/setup',0700);
$checks=0;
function check($ok,$why){global $checks;if(!$ok)throw new RuntimeException($why);$checks++;}
function denied($fn,$code=422){try{$fn();throw new RuntimeException('Expected rejection');}catch(ApiError $e){check($e->http===$code,$e->getMessage());}}
function removeTree($dir){foreach(scandir($dir)as $name){if($name==='.'||$name==='..')continue;$p=$dir.'/'.$name;if(is_dir($p)&&!is_link($p))removeTree($p);else unlink($p);}rmdir($dir);}
try{
 $installer=new Installer(dirname(__DIR__),$base.'/var/config.json',$base.'/public');$key=$installer->setupKey();
 $form=['businessName'=>'Test business','baseUrl'=>'https://example.com/shop','password'=>'testing-password-123','confirmPassword'=>'testing-password-123','catalog'=>'diner'];
 check(!Installer::ready($installer->checks($base,false)),'HTTP and exposed private storage rejected');
 denied(fn()=>$installer->install($form,'wrong'),403);
 foreach(['https://example.com/?key=secret','https://name:password@example.com','javascript:alert(1)','http://example.com','https://example.com/#fragment']as $url)denied(fn()=>$installer->install(array_replace($form,['baseUrl'=>$url]),$key));
 denied(fn()=>$installer->install(array_replace($form,['password'=>str_repeat('x',73)]),$key));
 file_put_contents($base.'/var/catalog.json','existing');denied(fn()=>$installer->install($form,$key),409);check(file_get_contents($base.'/var/catalog.json')==='existing','Existing catalog preserved');unlink($base.'/var/catalog.json');
 file_put_contents($base.'/public/setup/install.php','placeholder');file_put_contents($base.'/public/setup/user-note.txt','keep');
 $result=$installer->install($form,$key);check(!$result['removed'],'Unexpected setup content prevents directory deletion');check(is_file($base.'/public/setup/user-note.txt'),'Unknown user file preserved');
 check($installer->installed(),'Partial cleanup still locks installation');check(!is_file($base.'/public/setup/install.php'),'Executable installer removed');
 $catalog=json_decode(file_get_contents($base.'/var/catalog.json'),true);check(count($catalog['categories'])===5,'Diner example installed');
 check(array_sum(array_map(fn($c)=>count($c['items']),$catalog['categories']))===35,'Diner example contains 35 items');
 denied(fn()=>$installer->install($form,$key),409);
 echo "Installer core: $checks checks passed.\n";
}finally{removeTree($base);}
