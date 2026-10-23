<?php
// CLI only. Output credentials locally, never through a web route.
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
umask(0077);require_once __DIR__.'/bootstrap.php';
$base=dirname(__DIR__);$dir=$argv[1]??$base.'/var';if(!is_dir($dir))mkdir($dir,0700,true);if(is_file($dir.'/config.json')){fwrite(STDERR,"Config exists; no changes made.\n");exit(1);}
$lock=fopen($dir.'/setup.lock','c');if(!$lock||!flock($lock,LOCK_EX))exit(1);if(is_file($dir.'/config.json')||is_file($dir.'/installed.lock')||is_file($dir.'/catalog.json')){fwrite(STDERR,"Existing installation data; no changes made.\n");exit(1);}
$dir=realpath($dir);
$manager=bin2hex(random_bytes(12));$driver=bin2hex(random_bytes(12));
$catalogSource=$argv[2]??$base.'/examples/starlit-diner/catalog.json';
copy($catalogSource,$dir.'/catalog.json');chmod($dir.'/catalog.json',0600);
$config=['public_base_url'=>'http://127.0.0.1:8097','tenant'=>'dyws-diner','catalog'=>$dir.'/catalog.json','database'=>$dir.'/dyws.sqlite','tracking_secret'=>bin2hex(random_bytes(32)),'manager_password_hash'=>password_hash($manager,PASSWORD_DEFAULT),'drivers'=>['demo-driver'=>['name'=>'Demo Driver','password_hash'=>password_hash($driver,PASSWORD_DEFAULT)]]];
$accounts=new \dyws\AdminAccounts($config);$accounts->effective();unset($accounts);unset($config['manager_password_hash'],$config['drivers']);
file_put_contents($dir.'/config.json',json_encode($config,JSON_PRETTY_PRINT));chmod($dir.'/config.json',0600);
file_put_contents($dir.'/LOCAL-ACCESS.txt',"dyws demo access\nManager password: $manager\nDriver ID: demo-driver\nDriver password: $driver\nUse fictional customer details only. These are test operations, not real payments.\n");chmod($dir.'/LOCAL-ACCESS.txt',0600);echo "Created private config and LOCAL-ACCESS.txt in $dir\n";
