<?php
declare(strict_types=1);
use dyws\PluginContext;
use dyws\Plugins\OrderReporting\OrderReports;
require_once __DIR__.'/OrderReports.php';
return static function(PluginContext $plugin):void {
 $zone=static fn()=>(new \dyws\Settings($plugin->config))->read()['timeZone'];
 $service=static fn()=>new OrderReports($plugin->store,$zone());
 $currency=static fn()=>\dyws\Catalog::load($plugin->config['catalog'])['currency'];
 $plugin->addFilter('reports.summary',static function(array $report)use($service):array{
  try{$report['orderReporting']=$service()->dashboard($report['from'],$report['to'],$report['currency'],$_GET);}catch(\dyws\ApiError $e){$report['orderReportingError']=$e->getMessage();}return $report;
 });
 $plugin->route('GET','/manager/plugins/order-reporting/dashboard','manager',static function()use($service,$currency,$zone):array{
  [$from,$to]=OrderReports::range($_GET,$zone());return $service()->dashboard($from,$to,$currency(),$_GET);
 });
};
