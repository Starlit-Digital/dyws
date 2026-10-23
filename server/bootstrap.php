<?php
declare(strict_types=1);
use StarlitGo\Store;
use StarlitGo\ApiError;
require_once __DIR__.'/Store.php';
function starlit_bootstrap():array {
 $configPath=getenv('STARLIT_GO_CONFIG')?:dirname(__DIR__).'/var/config.json';
 if(!is_file($configPath))throw new ApiError('The order service has not been configured.',503);
 $config=json_decode(file_get_contents($configPath),true,512,JSON_THROW_ON_ERROR);
 if(strlen($config['tracking_secret']??'')<32)throw new ApiError('The order service has not been configured.',503);
 $GLOBALS['starlit_config']=$config;
 $catalog=json_decode(file_get_contents($config['catalog']),true,512,JSON_THROW_ON_ERROR);
 return [$config,new Store($config['database'],$catalog,$config['tenant'])];
}
