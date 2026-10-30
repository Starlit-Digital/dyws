<?php
declare(strict_types=1);
require __DIR__.'/../server/bootstrap.php';
$dir=sys_get_temp_dir().'/dyws-booking-no-catalog-'.bin2hex(random_bytes(6));mkdir($dir,0700);
try{
 $config=['database'=>$dir.'/orders.sqlite','tenant'=>'booking-only','tracking_secret'=>str_repeat('x',64),'business_name'=>'Example Service','required_plugins'=>['booking'],'booking'=>['services'=>[['id'=>'consultation','name'=>'Consultation','duration'=>30]],'days'=>[1,2,3,4,5,6,7]]];
 file_put_contents($dir.'/config.json',json_encode($config));
 file_put_contents($dir.'/plugins-'.substr(hash('sha256',$config['tenant']),0,16).'.json',json_encode(['active'=>['booking'],'known'=>['booking','catalog','pickup','delivery','datatables','order-reporting']]));
 [$loaded,$store]=dyws_bootstrap($dir.'/config.json');
 $plugin=$store->plugins->match('POST','/plugins/booking/availability');if(!$plugin)throw new RuntimeException('Booking unavailable');
 $date=(new DateTimeImmutable('tomorrow',new DateTimeZone('America/Edmonton')))->format('Y-m-d');$available=($plugin['handler'])(['serviceId'=>'consultation','date'=>$date],null,[]);if(!$available['slots'])throw new RuntimeException('No availability');
 $reserve=$store->plugins->match('POST','/plugins/booking/reserve');$receipt=($reserve['handler'])(['serviceId'=>'consultation','startsAt'=>$available['slots'][0]['startsAt'],'customer'=>['name'=>'Fictional Guest','phone'=>'7805550142'],'idempotencyKey'=>bin2hex(random_bytes(16)),'acknowledged'=>true],null,[]);if($receipt['status']!=='confirmed')throw new RuntimeException('Booking failed');
 if(file_exists($dir.'/catalog.json'))throw new RuntimeException('Unexpected catalog file');
 $config['catalog']=$dir.'/missing.json';file_put_contents($dir.'/config.json',json_encode($config));
 try{dyws_bootstrap($dir.'/config.json');throw new RuntimeException('Missing configured catalog accepted');}catch(\dyws\ApiError $e){if($e->http!==503)throw $e;}
 echo "Booking without catalog: availability, reservation, no catalog file and missing configured catalog checks passed.\n";
}finally{foreach(glob($dir.'/*') as $f)unlink($f);rmdir($dir);}
