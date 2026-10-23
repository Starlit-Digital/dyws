<?php
declare(strict_types=1);
use StarlitGo\{PluginContext,ApiError};
return static function(PluginContext $plugin):void {
 $plugin->addValidator('order.validating',static function(array $order):void {
  $note=$order['pluginData']['gift-note']['message']??'';
  if(!is_string($note)||strlen($note)>200)throw new ApiError('Keep the gift note within 200 bytes.');
 });
};
