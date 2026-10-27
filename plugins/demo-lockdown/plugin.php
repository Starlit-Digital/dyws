<?php
declare(strict_types=1);
use dyws\{PluginContext,ApiError};
require_once __DIR__.'/DemoPolicy.php';
return #[\dyws\Provides('pickup.map','location.renderer','checkout:fields','admin:navigation','admin:order','tracking:updated')] static function(PluginContext $plugin):void {
 if(($plugin->config['demo_lockdown']??false)!==true||!in_array('demo-lockdown',$plugin->config['required_plugins']??[],true))throw new RuntimeException('Installation Lockdown requires private installation configuration.');
 $policy=new \dyws\Plugins\DemoLockdown\DemoPolicy($plugin->config,$plugin->store);
 $plugin->addValidator('installation.validating',[$policy,'installation']);
 $plugin->addValidator('request.validating',[$policy,'request']);
 $plugin->addValidator('auth.validating',[$policy,'login']);
 $plugin->addFilter('order.input',[$policy,'orderInput']);
 $plugin->addValidator('order.validating',[$policy,'order']);
 $plugin->addFilter('page.presentation',[$policy,'presentation']);
};
