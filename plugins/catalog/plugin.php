<?php
declare(strict_types=1);
use dyws\{PluginContext,Catalog,Settings,Store,ApiError};
require_once __DIR__.'/Pricing.php';
return static function(PluginContext $plugin):void {
 $plugin->onActivate(static function()use($plugin):void {if(!is_string($plugin->config['catalog']??null)||!is_file($plugin->config['catalog']))throw new ApiError('Configure a catalog before activating this plugin.',409);});
 $plugin->provideOperation('cart.price',[\dyws\Plugins\Catalog\Pricing::class,'cart']);
 $read=static function()use($plugin):array{$catalog=Catalog::load($plugin->config['catalog']);return ['catalog'=>$catalog,'revision'=>Catalog::revision($catalog)];};
 $plugin->route('GET','/catalog','public',static function()use($plugin):array{$settings=(new Settings($plugin->config))->read();return $plugin->store->plugins->applyFilters('catalog.public',Catalog::publicData(Catalog::load($plugin->config['catalog']),$settings['timeZone'],$settings['acceptingOrders']));});
 $plugin->route('GET','/manager/catalog','manager',$read);
 $plugin->route('POST','/manager/catalog','manager',static function(array $body)use($plugin):array{
  if(!is_array($body['catalog']??null))throw new ApiError('Provide a catalog object.');
  $plugin->store->plugins->validate('catalog.validating',Catalog::validate($body['catalog']));
  $catalog=Catalog::save($plugin->config['catalog'],$body['catalog'],Store::text($body['revision']??null,64));return ['catalog'=>$catalog,'revision'=>Catalog::revision($catalog)];
 },['maxBody'=>262144]);
};
