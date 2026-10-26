<?php
declare(strict_types=1);
use dyws\PluginContext;
use dyws\Plugins\OrderReporting\{OrderReports,ReportExport,ReportEmail};
require_once __DIR__.'/OrderReports.php';
require_once __DIR__.'/ReportExport.php';
require_once __DIR__.'/ReportEmail.php';
return #[\dyws\Provides('reports.renderer','admin:report-controls','reports:query','reports:export')] static function(PluginContext $plugin):void {
 $zone=static fn()=>(new \dyws\Settings($plugin->config))->read()['timeZone'];
 $service=static fn()=>new OrderReports($plugin->store,$zone());
 $currency=static fn()=>\dyws\Catalog::load($plugin->config['catalog'])['currency'];
 $email=static fn()=>new ReportEmail($plugin->store,$plugin->config);
 $plugin->route('GET','/manager/plugins/order-reporting/export-options','manager',static fn()=>['email'=>$email()->availability(),'sections'=>ReportExport::SECTIONS]);
 $prepare=static function(array $body)use($service,$currency,$zone,$plugin):array {
  $query=$body['query']??[];if(!is_array($query))throw new \dyws\ApiError('Provide report filters.');
  $sections=ReportExport::sections($body['sections']??ReportExport::SECTIONS);$format=$body['format']??'pdf';
  if(!is_string($format))throw new \dyws\ApiError('Choose PDF, CSV or text.');
  [$from,$to]=OrderReports::range($query,$zone());$data=$service()->dashboard($from,$to,$currency(),$query);
  $catalog=\dyws\Catalog::load($plugin->config['catalog']);return ReportExport::make($data,$catalog['businessName'],$sections,$format);
 };
 $plugin->route('POST','/manager/plugins/order-reporting/export','manager',static function(array $body)use($prepare):array {
  $file=$prepare($body);$file['content']=base64_encode($file['content']);return $file+['encoding'=>'base64'];
 },['rateLimit'=>['report-export',30,3600]]);
 $plugin->route('POST','/manager/plugins/order-reporting/email','manager',static function(array $body)use($prepare,$email):array {
  $availability=$email()->availability();if(!$availability['enabled'])throw new \dyws\ApiError($availability['reason'],503);
  $key=\dyws\Store::text($body['idempotencyKey']??null,80);return $email()->send($prepare($body),array_intersect_key($body,array_flip(['query','sections','format'])),$key);
 },['rateLimit'=>['report-email',5,3600]]);
 $plugin->addFilter('reports.summary',static function(array $report)use($service):array{
  try{$report['orderReporting']=$service()->dashboard($report['from'],$report['to'],$report['currency'],$_GET);}catch(\dyws\ApiError $e){$report['orderReportingError']=$e->getMessage();}return $report;
 });
 $plugin->route('GET','/manager/plugins/order-reporting/dashboard','manager',static function()use($service,$currency,$zone):array{
  [$from,$to]=OrderReports::range($_GET,$zone());return $service()->dashboard($from,$to,$currency(),$_GET);
 });
};
