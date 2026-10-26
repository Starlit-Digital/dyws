<?php
declare(strict_types=1);
require __DIR__.'/../server/bootstrap.php';
require __DIR__.'/../plugins/order-reporting/OrderReports.php';
require __DIR__.'/../plugins/order-reporting/ReportExport.php';
require __DIR__.'/../plugins/order-reporting/ReportEmail.php';
use dyws\{Store,Catalog,ApiError};use dyws\Plugins\OrderReporting\{OrderReports,ReportExport,ReportEmail};
$dir=sys_get_temp_dir().'/dyws-export-'.bin2hex(random_bytes(6));mkdir($dir,0700);$checks=0;
$GLOBALS['dyws_config']=['tracking_secret'=>str_repeat('x',64)];
function check($ok){global $checks;if(!$ok)throw new RuntimeException('Check '.($checks+1).' failed');$checks++;}
function denied(callable $fn,int $code=422){try{$fn();throw new RuntimeException('Expected rejection');}catch(ApiError $e){check($e->http===$code);}}
try{
 $catalog=Catalog::load(__DIR__.'/../examples/starlit-diner/catalog.json');$catalog['businessEmail']='owner@example.test';Catalog::write($dir.'/catalog.json',$catalog);
 $config=['tenant'=>'exports','database'=>$dir.'/db.sqlite','catalog'=>$dir.'/catalog.json'];$store=new Store($config['database'],$catalog,$config['tenant']);
 $receipt=$store->create(['idempotencyKey'=>'export-fixture-order-key','customer'=>['name'=>'Fictional private name','phone'=>'7805550199'],'lines'=>[['id'=>'breakfast0','variant'=>'','quantity'=>1]]]);
 [$from,$to]=OrderReports::range([]);$data=(new OrderReports($store))->dashboard($from,$to,'CAD');$data['current']['items'][0]['name']='=HYPERLINK("https://example.test")';
 foreach(['csv','txt','pdf'] as $format){$file=ReportExport::make($data,'Fictional Café <script>',ReportExport::SECTIONS,$format);check(str_ends_with($file['name'],'.'.$format));check(!str_contains($file['content'],'Fictional private name'));if($format==='pdf'){check(str_starts_with($file['content'],'%PDF-'));file_put_contents('/tmp/dyws-report-preview.pdf',$file['content']);}else{check(str_contains($file['content'],'Timezone')||str_contains($file['content'],'America/Edmonton'));if($format==='csv')check(str_contains($file['content'],"'=HYPERLINK"));}}
 $file=ReportExport::make($data,'Business',['overview'],'txt');check(!str_contains($file['content'],'Daily trend'));
 denied(fn()=>ReportExport::sections([]));denied(fn()=>ReportExport::sections([['bad']]));denied(fn()=>ReportExport::make($data,'Business',['overview'],'html'));
 $mail=new ReportEmail($store,$config);check(!$mail->availability()['enabled']);denied(fn()=>$mail->send($file,[],'test-email-key-001'),503);
 $config['report_email']=['enabled'=>true,'from'=>'reports@example.test'];$mail=new ReportEmail($store,$config);check($mail->availability()['recipient']==='owner@example.test');
 $calls=0;$transport=function($to,$subject,$body,$headers)use(&$calls){$calls++;check($to==='owner@example.test');check($headers['From']==='reports@example.test');check(str_contains($body,'Content-Disposition: attachment'));return true;};
 $selection=['format'=>'txt','sections'=>['overview'],'query'=>['from'=>'2026-10-01','to'=>'2026-10-26']];
 check($mail->send($file,$selection,'test-email-key-001',$transport)['accepted']);check($mail->send($file,$selection,'test-email-key-001',$transport)['accepted']);check($calls===1);
 denied(fn()=>$mail->send($file,['format'=>'csv'],'test-email-key-001',$transport),409);
 denied(fn()=>$mail->send($file,$selection,'test-email-key-002',fn()=>false),503);denied(fn()=>$mail->send($file,$selection,'test-email-key-002',$transport),409);
 check($calls===1);echo "Report exports and email: $checks checks passed.\n";
}finally{foreach(glob($dir.'/*') as $file)unlink($file);rmdir($dir);}
