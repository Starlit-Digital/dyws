<?php
declare(strict_types=1);
use dyws\PluginContext;
use dyws\Plugins\OrderFormat\Templates;
require_once __DIR__.'/Templates.php';
return #[\dyws\Provides('order.layout','admin:navigation','admin:settings')] static function(PluginContext $plugin):void {
 $templates=new Templates($plugin->config);
 $plugin->route('GET','/plugins/order-format/layouts','public',fn()=>$templates->layouts());
 $plugin->route('GET','/manager/plugins/order-format/templates','manager',fn()=>$templates->summary());
 $plugin->route('POST','/manager/plugins/order-format/templates','manager',fn(array $body)=>$templates->save($body),['maxBody'=>65536]);
};
