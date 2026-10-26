<?php
declare(strict_types=1);
require __DIR__.'/../server/Store.php';
require __DIR__.'/../plugins/order-reporting/OrderReports.php';
use dyws\Store;use dyws\ApiError;use dyws\Plugins\OrderReporting\OrderReports;
$path=tempnam(sys_get_temp_dir(),'dyws-reports-');$catalog=json_decode(file_get_contents(__DIR__.'/../examples/starlit-diner/catalog.json'),true);$GLOBALS['dyws_config']=['tracking_secret'=>str_repeat('r',64)];$s=new Store($path,$catalog);$checks=0;
function check($ok,$message){global $checks;if(!$ok)throw new RuntimeException($message);$checks++;}
function stamp($day){return (new DateTimeImmutable($day,new DateTimeZone(OrderReports::TIMEZONE)))->getTimestamp();}
function seed($store,$date,$status='placed',$currency='CAD',$fulfillment='pickup'){
 $r=$store->create(['idempotencyKey'=>bin2hex(random_bytes(16)),'customer'=>['name'=>'Fictional Customer','phone'=>'7805550100'],'lines'=>[['id'=>'breakfast0','variant'=>'','quantity'=>1]],'fulfillment'=>$fulfillment,'address'=>'100 Fictional Road','notes'=>'']);
 $store->execute('UPDATE orders SET created_at=?,status=?,currency=? WHERE id=?',[stamp($date),$status,$currency,$r['id']]);return $r;
}
try {
 $a=seed($s,'2026-03-08 00:30:00','completed');$b=seed($s,'2026-03-08 23:30:00','cancelled');$c=seed($s,'2026-03-07 12:00:00','completed');$usd=seed($s,'2026-03-08 12:00:00','placed','USD');$delivery=seed($s,'2026-03-09 01:00:00','delivered','CAD','delivery');
 $s->execute("INSERT INTO payments(tenant,order_id,kind,amount,created_at) VALUES(?,?,'capture',?,?)",[$s->tenant,$c['id'],$c['total'],stamp('2026-03-08 01:00:00')]);
 $s->execute("INSERT INTO payments(tenant,order_id,kind,amount,created_at) VALUES(?,?,'refund',600,?)",[$s->tenant,$c['id'],stamp('2026-03-09 12:00:00')]);
 foreach([['r1',200,'2026-03-08 03:30:00'],['r2',400,'2026-03-09 12:00:00']] as [$event,$amount,$day])$s->execute('INSERT INTO payment_refund_deltas VALUES(?,?,?,?,?,?,?,?)',[$s->tenant,$event,$c['id'],$amount,$amount-10,10,0,stamp($day)]);
 foreach([['accepted','2026-03-08 01:30:00'],['ready','2026-03-08 03:45:00']]as[$status,$date])$s->execute('INSERT INTO events(tenant,order_id,status,actor,created_at) VALUES(?,?,?,?,?)',[$s->tenant,$a['id'],$status,'manager',stamp($date)]);
 $reporter=new OrderReports($s);[$from,$to]=OrderReports::range(['from'=>'2026-03-08','to'=>'2026-03-08']);$report=$reporter->dashboard($from,$to,'CAD');$r=$report['current'];$v=$r['summary'];
 check($to-$from===23*3600,'DST calendar day has 23 hours');check($v['orders']===2,'Both boundary orders included, USD and next day excluded');check($v['cancelled']===1&&$v['completed']===1,'Statuses from scoped cohort');check($v['orderedValue']===$a['total']&&$v['averageOrder']===$a['total'],'Cancelled values excluded');check($v['completionRate']===50.0,'Completion denominator includes all orders');
 check($v['captured']===$c['total']&&$v['refunded']===200,'Payments use ledger date, not order date or cumulative refund');check($v['netSales']+$v['netTax']+$v['netDeliveryFees']===$v['netCollected'],'Money components reconcile');check($r['daily'][0]['netCollected']===$v['netCollected'],'Trend reconciles');check($v['preparationSeconds']===4500&&$v['preparationSamples']===1,'Durations respect DST and missing event pairs');check($r['items'][0]['quantity']===1,'Cancelled and other currency items excluded');check($report['previous']['orders']===1,'Previous matching calendar range');check($report['currencies']===['CAD','USD'],'Available currencies');
 [$from,$to]=OrderReports::range(['from'=>'2026-03-08','to'=>'2026-03-10']);$full=$reporter->dashboard($from,$to,'CAD');check(count($full['current']['daily'])===3&&$full['current']['daily'][2]['orders']===0,'Zero filled dates');check($full['current']['summary']['refunded']===600,'Delta refunds counted exactly once');
 $only=$reporter->dashboard($from,$to,'CAD',['fulfillment'=>'delivery']);check($only['current']['summary']['orders']===1&&$only['current']['summary']['captured']===0,'Fulfilment scoped ledger and orders');
 $only=$reporter->dashboard($from,$to,'CAD',['currency'=>'USD']);check($only['current']['summary']['orders']===1,'Currency selector');
 $other=new Store($path,$catalog,'other');$otherReport=(new OrderReports($other))->dashboard($from,$to,'CAD');check($otherReport['current']['summary']['orders']===0&&$otherReport['current']['summary']['captured']===0,'Tenant isolated');
 foreach([['from'=>'2026-02-30'],['from'=>[]],['from'=>'2026-04-01','to'=>'2026-03-01'],['from'=>'2020-01-01','to'=>'2026-01-01']]as$q){try{OrderReports::range($q);throw new RuntimeException('Invalid range accepted');}catch(ApiError $e){check($e->http===422,'Invalid dates rejected');}}
 foreach([['currency'=>'<script>'],['fulfillment'=>[]]]as$q){try{$reporter->dashboard($from,$to,'CAD',$q);throw new RuntimeException('Invalid filter');}catch(ApiError $e){check($e->http===422,'Invalid filters rejected');}}
 $metrics=$full['current']['summary'];
 check($metrics['customers']===1&&$metrics['returningCustomers']===1&&$metrics['newCustomers']===0&&$metrics['repeatCustomerRate']===100.0,'Returning customers are deduplicated and include earlier history');
 check($metrics['units']===2&&$metrics['itemsPerOrder']===1.0&&$metrics['cancelledValue']===$b['total'],'Basket and cancellation values use correct cohorts');
 check($metrics['preparationMedianSeconds']===4500&&$metrics['preparationP90Seconds']===4500,'Percentiles use measured duration samples');
 check(array_sum(array_map('array_sum',$full['current']['heatmap']))===3,'Heatmap reconciles to all orders');
 check(array_sum(array_column($full['current']['locations'],'orderedValue'))===$metrics['orderedValue'],'Location values reconcile');
 $s->execute('UPDATE orders SET customer_phone=? WHERE id=?',['+1 (780) 555-0100',$a['id']]);
 check($reporter->dashboard($from,$to,'CAD')['current']['summary']['customers']===1,'Equivalent phone formats count as one customer');
 $serialized=json_encode($full);foreach(['Fictional Customer','7805550100','tracking','latitude','customer_phone'] as $private)check(!str_contains($serialized,$private),'No private order details');
 $before=$s->query('SELECT id,created_at,updated_at FROM orders ORDER BY id');
 [$utcStart,$utcEnd]=OrderReports::range(['from'=>'2026-03-08','to'=>'2026-03-08'],'UTC');
 check($utcEnd-$utcStart===86400&&gmdate('H:i',$utcStart)==='00:00','UTC boundaries');
 [$tokyoStart,$tokyoEnd]=OrderReports::range(['from'=>'2026-03-08','to'=>'2026-03-08'],'Asia/Tokyo');
 check(gmdate('Y-m-d H:i',$tokyoStart)==='2026-03-07 15:00','Local midnight converted to UTC');
 $tokyo=(new OrderReports($s,'Asia/Tokyo'))->dashboard($tokyoStart,$tokyoEnd,'CAD');
 check($tokyo['timeZone']==='Asia/Tokyo'&&$tokyo['current']['summary']['orders']===2,'Selected zone controls order date inclusion');
 check($tokyo['current']['hours'][16]['count']===1,'Hourly report uses selected timezone');
 [$fallStart,$fallEnd]=OrderReports::range(['from'=>'2026-11-01','to'=>'2026-11-01'],'America/Toronto');
 check($fallEnd-$fallStart===25*3600,'Fall DST day has 25 hours');
 check($before===$s->query('SELECT id,created_at,updated_at FROM orders ORDER BY id'),'Timezone changes never alter stored instants');
 echo "Reporting: $checks checks passed.\n";
}finally{unset($s,$other);foreach([$path,$path.'-wal',$path.'-shm']as$f)if(is_file($f))unlink($f);}
