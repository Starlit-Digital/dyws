<?php
// CLI only. Output credentials locally, never through a web route.
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
$base=dirname(__DIR__);$dir=$argv[1]??$base.'/var';if(!is_dir($dir))mkdir($dir,0700,true);if(is_file($dir.'/config.json')){fwrite(STDERR,"Config exists; no changes made.\n");exit(1);}
$manager=bin2hex(random_bytes(12));$driver=bin2hex(random_bytes(12));
$catalogSource=$argv[2]??$base.'/examples/starlit-diner/catalog.json';
copy($catalogSource,$dir.'/catalog.json');chmod($dir.'/catalog.json',0600);
$config=['public_base_url'=>'http://127.0.0.1:8097','tenant'=>'starlit-diner','catalog'=>$dir.'/catalog.json','database'=>$dir.'/starlit-go.sqlite','tracking_secret'=>bin2hex(random_bytes(32)),'manager_password_hash'=>password_hash($manager,PASSWORD_DEFAULT),'drivers'=>['demo-driver'=>['name'=>'Demo Driver','password_hash'=>password_hash($driver,PASSWORD_DEFAULT)]]];
file_put_contents($dir.'/config.json',json_encode($config,JSON_PRETTY_PRINT));chmod($dir.'/config.json',0600);
file_put_contents($dir.'/LOCAL-ACCESS.txt',"Starlit Go demo access\nManager password: $manager\nDriver ID: demo-driver\nDriver password: $driver\nUse fictional customer details only. These are test operations, not real payments.\n");chmod($dir.'/LOCAL-ACCESS.txt',0600);echo "Created private config and LOCAL-ACCESS.txt in $dir\n";
