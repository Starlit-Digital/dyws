<?php
declare(strict_types=1);
use dyws\PluginContext;
use dyws\Plugins\OrderReporting\{OrderReports,ReportExport,ReportEmail};
require_once __DIR__.'/OrderReports.php';
require_once __DIR__.'/ReportExport.php';
require_once __DIR__.'/VisualReportPDF.php';
require_once __DIR__.'/PdfArchive.php';
require_once __DIR__.'/ReportEmail.php';
return #[\dyws\Provides('reports.renderer','admin:report-controls','reports:query','reports:export')] static function(PluginContext $plugin):void {
 $plugin->addFilter('reports.dataset',static function(array $data)use($plugin):array{$catalog=\dyws\Catalog::load($plugin->config['catalog']);$data['workingHours']=$catalog['locationHours'];$data['storeCurrency']=$catalog['currency'];$data['demo']=($plugin->config['demo_lockdown']??false)===true;$data['businessInfo']=array_intersect_key($catalog,array_flip(['businessName','pickupAddress','businessPhone','businessEmail']));$data['businessInfo']['businessWebsite']=$plugin->config['reporting']['businessWebsite']??'';return $data;});
 $zone=static fn()=>(new \dyws\Settings($plugin->config))->read()['timeZone'];
 $service=static fn()=>new OrderReports($plugin->store,$zone());
 $currency=static fn()=>\dyws\Catalog::load($plugin->config['catalog'])['currency'];
 $email=static fn()=>new ReportEmail($plugin->store,$plugin->config);
 $plugin->route('GET','/manager/plugins/order-reporting/export-options','manager',static fn()=>['email'=>$email()->availability(),'sections'=>ReportExport::SECTIONS]);
 $archive=static fn()=>new \dyws\Plugins\OrderReporting\PdfArchive($plugin->store,$plugin->config);
 $plugin->route('GET','/manager/plugins/order-reporting/archive','manager',static fn()=> $archive()->search($_GET));
 $plugin->route('POST','/manager/plugins/order-reporting/archive/download','manager',static fn(array $body)=>$archive()->download(\dyws\Store::text($body['id']??null,32)));
 $prepare=static function(array $body)use($service,$currency,$zone,$plugin,$archive):array {
  $query=$body['query']??[];if(!is_array($query))throw new \dyws\ApiError('Provide report filters.');
  $sections=ReportExport::sections($body['sections']??ReportExport::SECTIONS);$format=$body['format']??'pdf';
  if(!is_string($format))throw new \dyws\ApiError('Choose PDF, CSV or text.');
  [$from,$to]=OrderReports::range($query,$zone());$data=$service()->dashboard($from,$to,$currency(),$query);$catalog=\dyws\Catalog::load($plugin->config['catalog']);
  if(array_key_exists('target',$body)){if($format!=='pdf'||!is_string($body['target']))throw new \dyws\ApiError('Choose a valid PDF report.');$catalog=\dyws\Catalog::load($plugin->config['catalog']);$file=\dyws\Plugins\OrderReporting\VisualReportPDF::make($data,$catalog['businessName'],$body['target']);return $archive()->save($file,$data,[],$body['target']);}
  $catalog=\dyws\Catalog::load($plugin->config['catalog']);$file=ReportExport::make($data,$catalog['businessName'],$sections,$format);return $format==='pdf'?$archive()->save($file,$data,$sections,'report'):$file;
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
