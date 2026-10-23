<?php
declare(strict_types=1);
use dyws\Store;
use dyws\ApiError;
require_once __DIR__.'/Store.php';
require_once __DIR__.'/Catalog.php';
require_once __DIR__.'/Lookup.php';
require_once __DIR__.'/AdminAccounts.php';
require_once __DIR__.'/Settings.php';
require_once __DIR__.'/Plugins.php';
require_once __DIR__.'/Realtime.php';
function dyws_bootstrap(?string $configPath=null):array {
 date_default_timezone_set('UTC');
 $configPath=$configPath?:getenv('DYWS_CONFIG');
 if(!$configPath)throw new ApiError('A private configuration path is required.',503);
 if(!is_file($configPath))throw new ApiError('The order service has not been configured.',503);
 $config=json_decode(file_get_contents($configPath),true,512,JSON_THROW_ON_ERROR);
 if(strlen($config['tracking_secret']??'')<32)throw new ApiError('The order service has not been configured.',503);
 $config=(new \dyws\AdminAccounts($config))->effective();
 $GLOBALS['dyws_config']=$config;
 $catalog=\dyws\Catalog::load($config['catalog']);
 return [$config,new Store($config['database'],$catalog,$config['tenant'])];
}
