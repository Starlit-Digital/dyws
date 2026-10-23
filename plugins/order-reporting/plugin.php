<?php
declare(strict_types=1);
use StarlitGo\PluginContext;
use StarlitGo\Plugins\OrderReporting\OrderReports;
require_once __DIR__.'/OrderReports.php';
return static function(PluginContext $plugin):void {
 $service=static fn()=>new OrderReports($plugin->store);
 $currency=static fn()=>\StarlitGo\Catalog::load($plugin->config['catalog'])['currency'];
 $plugin->addFilter('reports.summary',static function(array $report)use($service):array{
  try{$report['orderReporting']=$service()->dashboard($report['from'],$report['to'],$report['currency'],$_GET);}catch(\StarlitGo\ApiError $e){$report['orderReportingError']=$e->getMessage();}return $report;
 });
 $plugin->route('GET','/manager/plugins/order-reporting/dashboard','manager',static function()use($service,$currency):array{
  [$from,$to]=OrderReports::range($_GET);return $service()->dashboard($from,$to,$currency(),$_GET);
 });
};
