<?php
declare(strict_types=1);
require __DIR__.'/../server/bootstrap.php';
require __DIR__.'/../plugins/order-reporting/OrderReports.php';
require __DIR__.'/../plugins/order-reporting/VisualReportPDF.php';
use dyws\Plugins\OrderReporting\{OrderReports,VisualReportPDF,PdfIdentity};
$dir=sys_get_temp_dir().'/dyws-visual-pdf-'.bin2hex(random_bytes(5));mkdir($dir,0700);$GLOBALS['dyws_config']=['tracking_secret'=>str_repeat('x',64)];
$catalog=dyws\Catalog::load(__DIR__.'/../examples/starlit-diner/catalog.json');$store=new dyws\Store($dir.'/db.sqlite',$catalog,'pdf-test');[$from,$to]=OrderReports::range(['from'=>'2026-10-01','to'=>'2026-10-07']);$data=(new OrderReports($store))->dashboard($from,$to,'CAD');$data['demo']=false;$data['workingHours']=$catalog['locationHours'];$data['businessInfo']=['pickupAddress'=>'123 Example Street','businessPhone'=>'780 555 0100','businessEmail'=>'owner@example.test','businessWebsite'=>'https://example.test'];$references=[];$checks=0;
function verify($value){global $checks;if(!$value)throw new RuntimeException('Visual PDF check failed: '.($checks+1));$checks++;}
try{
 foreach(VisualReportPDF::TARGETS as $target){$file=VisualReportPDF::make($data,'Example Business',$target);verify(str_starts_with($file['content'],'%PDF-'));verify(str_starts_with($file['name'],'example-business-'));verify(preg_match('/^[A-Z0-9]{16}$/D',$file['identity']['reference'])===1);verify(str_ends_with($file['identity']['generatedAt'],'+00:00'));$references[]=$file['identity']['reference'];}
 verify(count(array_unique($references))===count(VisualReportPDF::TARGETS));verify(!str_contains(PdfIdentity::notes($data),'Demonstration'));$data['demo']=true;verify(str_contains(PdfIdentity::notes($data),'Demonstration'));
 $header=PdfIdentity::header($data,'Example <script>');verify(str_contains($header,'&lt;script&gt;'));foreach($data['businessInfo'] as $value)verify(str_contains($header,$value));
 echo "Visual PDFs: $checks checks passed across ".count(VisualReportPDF::TARGETS)." targets.\n";
}finally{unset($store);foreach(glob($dir.'/*') as $path)unlink($path);rmdir($dir);}
