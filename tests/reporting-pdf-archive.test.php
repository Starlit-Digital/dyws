<?php
declare(strict_types=1);
require dirname(__DIR__).'/server/bootstrap.php';
require dirname(__DIR__).'/plugins/order-reporting/PdfArchive.php';
$dir=sys_get_temp_dir().'/dyws-archive-test-'.bin2hex(random_bytes(6));mkdir($dir,0700);$GLOBALS['dyws_config']['tracking_secret']=str_repeat('a',64);
$config=['database'=>$dir.'/test.sqlite'];$a=new dyws\Store($config['database'],[],'a');$b=new dyws\Store($config['database'],[],'b');$archive=new dyws\Plugins\OrderReporting\PdfArchive($a,$config);$other=new dyws\Plugins\OrderReporting\PdfArchive($b,$config);
function check($value,$message){if(!$value)throw new RuntimeException($message);}
$data=['range'=>['from'=>'2026-10-09','to'=>'2026-11-07'],'previousRange'=>['from'=>'2026-09-09','to'=>'2026-10-08'],'currency'=>'CAD','fulfillment'=>'pickup','timeZone'=>'America/Edmonton','workingHours'=>['enabled'=>true],'businessInfo'=>['businessName'=>'Example']];
$file=['name'=>'overview.pdf','type'=>'application/pdf','content'=>"%PDF-1.4\ntest",'identity'=>['reference'=>'ABCDEFGHIJKLMNOP','generatedAt'=>'2026-11-07T17:00:00-07:00']];
$saved=$archive->save($file,$data,[],'overview');$id=$saved['archiveId'];
check($archive->search(['q'=>'ABCDEFGHIJKLMNOP','from'=>'2026-10-09','to'=>'2026-11-07','currency'=>'CAD','fulfillment'=>'pickup','target'=>'overview'])['total']===1,'Combined search');
check($archive->search(['currency'=>'USD'])['total']===0,'Filter mismatch');check($archive->search(['q'=>'%'])['total']===0,'Literal wildcard');check($other->search([])['total']===0,'Tenant search isolation');
check(base64_decode($archive->download($id)['content'])===$file['content'],'Exact original bytes');
foreach([$id,'../../etc/passwd'] as $bad){try{$other->download($bad);throw new RuntimeException('Cross tenant or invalid id accepted');}catch(dyws\ApiError $e){check($e->http===404,'Missing status');}}
$older=$file;$older['identity']['generatedAt']='2026-11-07T22:00:00+00:00';$archive->save($older,$data,[],'overview');check($archive->search([])['items'][0]['id']===$id,'Chronology across offsets');
$path=$dir.'/report-archive/'.hash('sha256','a').'/'.$id.'.pdf';check((fileperms($path)&0777)===0600,'Private file permissions');file_put_contents($path,'corrupt');try{$archive->download($id);throw new RuntimeException('Corruption accepted');}catch(dyws\ApiError $e){check($e->http===503,'Integrity denial');}
check($archive->search([])['items'][0]['settings']['workingHours']===['enabled'=>true],'Settings snapshot');
function clean($dir){foreach(scandir($dir) as $name)if($name!=='.'&&$name!=='..'){is_dir($dir.'/'.$name)?clean($dir.'/'.$name):unlink($dir.'/'.$name);}rmdir($dir);}unset($archive,$other,$a,$b);clean($dir);echo "PASS: archive filters, settings, exact bytes, tenant isolation, traversal denial, permissions and integrity\n";
