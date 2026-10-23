<?php
declare(strict_types=1);
use StarlitGo\Store;
use StarlitGo\ApiError;
require_once __DIR__.'/Store.php';
require_once __DIR__.'/Catalog.php';
require_once __DIR__.'/StripeSettings.php';
require_once __DIR__.'/StripePayments.php';
require_once __DIR__.'/AdminAccounts.php';
function dyws_bootstrap(?string $configPath=null):array {
 $configPath=$configPath?:getenv('DYWS_CONFIG')?:getenv('STARLIT_GO_CONFIG');
 if(!$configPath)throw new ApiError('A private configuration path is required.',503);
 if(!is_file($configPath))throw new ApiError('The order service has not been configured.',503);
 $config=json_decode(file_get_contents($configPath),true,512,JSON_THROW_ON_ERROR);
 if(strlen($config['tracking_secret']??'')<32)throw new ApiError('The order service has not been configured.',503);
 $config=(new \StarlitGo\AdminAccounts($config))->effective();
 $config['stripe_enabled']=(new \StarlitGo\StripeSettings($config))->read()['enabled'];
 $GLOBALS['starlit_config']=$config;
 $catalog=\StarlitGo\Catalog::load($config['catalog']);
 return [$config,new Store($config['database'],$catalog,$config['tenant'])];
}
