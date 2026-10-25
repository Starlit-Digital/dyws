<?php
declare(strict_types=1);
require_once __DIR__.'/Connector.php';
return #[\dyws\Provides('admin:settings')] static function(\dyws\PluginContext $plugin):void {
 $definition=json_decode(file_get_contents(__DIR__.'/connector.json'),true,32,JSON_THROW_ON_ERROR);
 $connector=new \dyws\Plugins\Square\Connector($plugin->config,$definition);
 \dyws\Payments\registerConnector($plugin,$connector);
};
