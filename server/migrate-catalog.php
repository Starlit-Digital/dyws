<?php
// One time migration: preserve existing deployment data and credentials.
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/Store.php';require __DIR__.'/Catalog.php';
$configPath=$argv[1]??dirname(__DIR__).'/var/config.json';
$config=json_decode(file_get_contents($configPath),true,512,JSON_THROW_ON_ERROR);
$target=dirname($configPath).'/catalog.json';
$catalog=\StarlitGo\Catalog::load($argv[3]??$config['catalog']);
\StarlitGo\Catalog::write($target,$catalog);
$config['catalog']=$target;
if(isset($argv[2]))$config['public_base_url']=rtrim($argv[2],'/');
\StarlitGo\Catalog::write($configPath,$config);
echo "Catalog migrated to private server JSON.\n";
