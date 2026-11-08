<?php
declare(strict_types=1);
namespace dyws\Plugins\OrderReporting;
use dyws\ApiError;
require_once __DIR__.'/PdfIdentity.php';

/** Trusted aggregate data only. Browser supplied HTML and SVG are never accepted. */
final class VisualReportPDF {
 public const TARGETS=['overview','at-a-glance','all-items','daily','payments','hours','payment-trend','orders-by-day','demand','top-items','order-flow','locations','fulfillment'];
 private static function esc($value):string{return htmlspecialchars((string)($value??'No data'),ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
 private static function image(string $svg):string{return '<img src="data:image/svg+xml;base64,'.base64_encode($svg).'">';}
 private static function table(array $headers,array $rows):string{return '<table><thead><tr>'.implode('',array_map(fn($h)=>'<th>'.self::esc($h).'</th>',$headers)).'</tr></thead><tbody>'.implode('',array_map(fn($r)=>'<tr>'.implode('',array_map(fn($v)=>'<td>'.self::esc($v).'</td>',$r)).'</tr>',$rows)).'</tbody></table>';}
 private static function svg(string $inside,int $height=300):string{return '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="'.$height.'" viewBox="0 0 720 '.$height.'"><rect width="720" height="'.$height.'" fill="#ffffff"/>'.$inside.'</svg>';}
 private static function trend(array $rows,string $key,bool $bars,string $currency):string {
  if(!$rows)return '<p>No orders.</p>';
  $values=array_map(fn($row)=>(int)$row[$key],$rows);$low=min(0,...$values);$high=max($bars?2:100,...$values);$span=max(1,$high-$low);$count=count($rows);
  $x=fn($i)=>110+($count<2?280:$i*570/($count-1));$y=fn($v)=>240-($v-$low)*190/$span;$format=fn($v)=>$bars?(string)(int)round($v):$currency.' '.number_format($v/100,2);$svg='';
  foreach([$low,($low+$high)/2,$high] as $v)$svg.='<path d="M110 '.$y($v).'H680" stroke="#cbd5cf"/><text x="100" y="'.($y($v)+4).'" text-anchor="end" font-family="sans-serif" font-size="12" fill="#26352c">'.self::esc($format($v)).'</text>';
  if($bars)foreach($values as $i=>$v)$svg.='<rect x="'.($x($i)-min(14,210/$count)).'" y="'.min($y($v),$y(0)).'" width="'.min(28,420/$count).'" height="'.abs($y($v)-$y(0)).'" fill="#c52f45"/>';
  else{$points=[];foreach($values as $i=>$v)$points[]=$x($i).','.$y($v);$svg.='<polyline points="'.implode(' ',$points).'" fill="none" stroke="#c52f45" stroke-width="2.5"/>';}
  foreach(array_unique([0,(int)floor(($count-1)/2),$count-1]) as $i)$svg.='<text x="'.$x($i).'" y="270" text-anchor="'.($i===0?'start':($i===$count-1?'end':'middle')).'" font-family="sans-serif" font-size="12">'.self::esc($rows[$i]['date']).'</text>';
  return self::image(self::svg($svg));
 }
 private static function green(float $ratio):array {
  $L=.42+.42*max(0,min(1,$ratio));$a=.10*cos(deg2rad(155));$b=.10*sin(deg2rad(155));$l=($L+.3963377774*$a+.2158037573*$b)**3;$m=($L-.1055613458*$a-.0638541728*$b)**3;$s=($L-.0894841775*$a-1.291485548*$b)**3;
  $rgb=[4.0767416621*$l-3.3077115913*$m+.2309699292*$s,-1.2684380046*$l+2.6097574011*$m-.3413193965*$s,-.0041960863*$l-.7034186147*$m+1.707614701*$s];$rgb=array_map(fn($v)=>max(0,min(1,$v)),$rgb);$lum=.2126*$rgb[0]+.7152*$rgb[1]+.0722*$rgb[2];$hex='#';foreach($rgb as $v)$hex.=sprintf('%02x',(int)round(255*($v<=.0031308?12.92*$v:1.055*($v**(1/2.4))-.055)));
  return [$hex,$lum>.179?'#000000':'#ffffff'];
 }
 private static function heatmap(array $data):string {
  $matrix=$data['current']['heatmap'];$schedule=$data['workingHours']??null;$minutes=fn($v)=>(int)substr($v,0,2)*60+(int)substr($v,3,2);$mask=[];$hours=[];$max=1;$totals=array_map('array_sum',$matrix);$dayMax=max(1,...$totals);$excluded=0;
  foreach(range(0,6) as $d)foreach(range(0,23) as $h){$open=!($schedule['enabled']??false);if(!$open){$day=$schedule['days'][$d];$previous=$schedule['days'][($d+6)%7];$open=$day['mode']==='allDay';if($day['mode']==='hours'){$a=$minutes($day['open']);$b=$minutes($day['close']);$open=$open||($h*60<($b>$a?$b:1440)&&($h+1)*60>$a);}if($previous['mode']==='hours'&&$minutes($previous['close'])<$minutes($previous['open']))$open=$open||$h*60<$minutes($previous['close']);}$mask[$d][$h]=$open;if($open){$hours[$h]=$h;$max=max($max,$matrix[$d][$h]);}else $excluded+=$matrix[$d][$h];}
  ksort($hours);$hours=array_values($hours);$width=620/max(1,count($hours));$svg='<text x="78" y="18" font-family="sans-serif" font-size="10" text-anchor="middle">Total</text>';
  foreach($hours as $i=>$h)$svg.='<text x="'.(100+$i*$width+$width/2).'" y="18" font-family="sans-serif" font-size="10" text-anchor="middle">'.sprintf('%02d',$h).'</text>';
  foreach($matrix as $d=>$row){$y=28+$d*28;$svg.='<text x="0" y="'.($y+17).'" font-family="sans-serif" font-size="11">'.['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][$d].'</text>';
   foreach(array_merge([['x'=>58,'w'=>38,'count'=>$totals[$d],'peak'=>$dayMax,'open'=>true]],array_map(fn($i)=>['x'=>100+$i*$width,'w'=>$width-2,'count'=>$row[$hours[$i]],'peak'=>$max,'open'=>$mask[$d][$hours[$i]]],array_keys($hours))) as $cell){[$bg,$ink]=$cell['count']?self::green($cell['count']/$cell['peak']):['#292c2b','#c8ceca'];if(!$cell['open']){$bg='#ffffff';$ink='#64726a';}$svg.='<rect x="'.$cell['x'].'" y="'.$y.'" width="'.$cell['w'].'" height="26" fill="'.$bg.'"/><text x="'.($cell['x']+$cell['w']/2).'" y="'.($y+17).'" text-anchor="middle" font-family="sans-serif" font-size="'.($cell['open']?10:8).'" fill="'.$ink.'">'.($cell['open']?$cell['count']:'Closed').'</text>';}
  }
  return self::image(self::svg($svg,235)).'<p class="note">Working hours only. Includes cancelled orders. Daily and hourly colours scale separately.'.($excluded?' Daily totals include '.$excluded.' orders outside these hours.':'').'</p>';
 }
 private static function topItems(array $rows):string {
  $rows=array_values(array_filter($rows,fn($row)=>$row['quantity']>0));usort($rows,fn($a,$b)=>$b['quantity']<=>$a['quantity']);$rows=array_slice($rows,0,10);$total=array_sum(array_column($rows,'quantity'));if(!$total)return '<p>No orders.</p>';
  $colors=['#8cd7a3','#dfbc66','#68c4b3','#ec967c','#90b5db','#bad17c','#e6a3b3','#c7b89a','#6dba87','#e3ca96'];$angle=-M_PI/2;$svg='';$legend=[];
  foreach($rows as $i=>$row){$sweep=$row['quantity']/$total*2*M_PI;$start=[160+140*cos($angle),160+140*sin($angle)];$end=[160+140*cos($angle+$sweep),160+140*sin($angle+$sweep)];$mid=$angle+$sweep/2;$svg.=count($rows)===1?'<circle cx="160" cy="160" r="140" fill="'.$colors[$i].'"/>':'<path d="M160 160 L'.implode(' ',$start).' A140 140 0 '.($sweep>M_PI?1:0).' 1 '.implode(' ',$end).' Z" fill="'.$colors[$i].'" stroke="#ffffff" stroke-width="2"/>';$svg.='<text x="'.(160+98*cos($mid)).'" y="'.(165+98*sin($mid)).'" text-anchor="middle" font-family="sans-serif" font-size="15" font-weight="bold">'.($i+1).'</text>';$angle+=$sweep;$legend[]=[$i+1,$row['name'].($row['option']?' · '.$row['option']:''),$row['quantity'],number_format($row['quantity']/$total*100,1).'%'];}
  $svg='<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320">'.$svg.'</svg>';
  return '<table class="layout"><tr><td width="42%">'.self::image($svg).'</td><td>'.self::table(['#','Item','Quantity','Share'],$legend).'</td></tr></table><p class="note">Top 10 by quantity. Share of '.$total.' units across these items. Cancelled orders excluded.</p>';
 }
 private static function paymentTable(array $data):string {
  $rows=[];foreach(['Payments'=>'captured','Refunds'=>'refunded','Net product payments'=>'netSales','Net delivery fees'=>'netDeliveryFees','Net tax'=>'netTax','Tips added'=>'orderedTips','Tips collected'=>'capturedTips','Tips refunded'=>'refundedTips','Net tips'=>'netTips'] as $label=>$key)$rows[]=[$label,number_format($data['current']['summary'][$key]/100,2)];return self::table(['Metric','Amount ('.$data['currency'].')'],$rows);
 }
 private static function dailyTable(array $data):string {
  return self::table(['Date','Orders','Ordered','Payments','Refunds','Net payments','Tips added','Tips collected','Tips refunded','Net tips'],array_map(fn($v)=>[$v['date'],$v['orders'],...array_map(fn($k)=>number_format($v[$k]/100,2),['orderedValue','captured','refunded','netCollected','orderedTips','capturedTips','refundedTips','netTips'])],$data['current']['daily']));
 }
 private static function panel(array $data,string $target):string {
  $r=$data['current'];
  return match($target){
   'payments'=>self::paymentTable($data),
   'daily'=>self::dailyTable($data),
   'all-items'=>self::table(['Item','Quantity','Ordered subtotal ('.$data['currency'].')'],array_map(fn($v)=>[$v['name'].($v['option']?' · '.$v['option']:''),$v['quantity'],number_format($v['orderedSubtotal']/100,2)],$r['items'])),
   'hours'=>self::table(['Hour ('.$data['timeZone'].')','Orders'],array_map(fn($v)=>[sprintf('%02d:00',$v['hour']),$v['count']],$r['hours'])),
   'at-a-glance'=>self::table(['Metric','Value'],[['Active orders',$r['summary']['active']],['Awaiting payment',$r['summary']['unpaidOrders']],['Unpaid value ('.$data['currency'].')',number_format($r['summary']['unpaidValue']/100,2)],['Preparation',$r['summary']['preparationSeconds']===null?'No data':round($r['summary']['preparationSeconds']/60,1).' min'],['Delivery',$r['summary']['deliverySeconds']===null?'No data':round($r['summary']['deliverySeconds']/60,1).' min']]),
   'payment-trend'=>self::trend($r['daily'],'netCollected',false,$data['currency']),
   'orders-by-day'=>self::trend($r['daily'],'orders',true,$data['currency']),
   'demand'=>self::heatmap($data),
   'top-items'=>self::topItems($r['items']),
   'order-flow'=>self::table(['Status','Orders'],array_map(fn($v)=>[ucwords(str_replace('_',' ',$v['status'])),$v['count']],$r['statuses'])),
   'locations'=>self::table(['Location','Orders','Cancelled','Ordered value ('.$data['currency'].')','Average order'],array_map(fn($v)=>[$v['name'],$v['orders'],$v['cancelled'],number_format($v['orderedValue']/100,2),number_format($v['averageOrder']/100,2)],$r['locations'])),
   'fulfillment'=>self::table(['Stage','Median','P90','Orders'],array_map(fn($k)=>[ucfirst($k),$r['summary'][$k.'MedianSeconds']===null?'No data':round($r['summary'][$k.'MedianSeconds']/60,1).' min',$r['summary'][$k.'P90Seconds']===null?'No data':round($r['summary'][$k.'P90Seconds']/60,1).' min',$r['summary'][$k.'Samples']],['acceptance','preparation','delivery']))
  };
 }
 private static function overview(array $data):string {
  $r=$data['current'];$s=$r['summary'];$money=fn($v)=>$data['currency'].' '.number_format(($v??0)/100,2);$duration=fn($v)=>$v===null?'No data':round($v/60,1).' min';
  $metrics=[];
  foreach(['Net tips'=>'netTips','Net payments'=>'netCollected','Average order'=>'averageOrder','Cancelled order value'=>'cancelledValue','Value per customer'=>'averageCustomerValue','Average delivery fee'=>'averageDeliveryFee'] as $label=>$key)$metrics[]=[$label,$money($s[$key])];
  foreach(['Orders'=>'orders','Active orders'=>'active','New customers'=>'newCustomers','Returning customers'=>'returningCustomers','Items per order'=>'itemsPerOrder'] as $label=>$key)$metrics[]=[$label,$s[$key]??'No data'];
  foreach(['Completed'=>'completionRate','Repeat customers'=>'repeatCustomerRate','Refunds / payments'=>'refundRate','Cancelled'=>'cancellationRate'] as $label=>$key)$metrics[]=[$label,isset($s[$key])?$s[$key].'%':'No data'];
  $metrics[]=['Awaiting payment',($s['unpaidOrders']??0).' · '.$money($s['unpaidValue'])];
  foreach(['Preparation'=>'preparationSeconds','Delivery'=>'deliverySeconds','Slower deliveries (P90)'=>'deliveryP90Seconds'] as $label=>$key)$metrics[]=[$label,$duration($s[$key])];
  $pairs=[];$half=(int)ceil(count($metrics)/2);for($i=0;$i<$half;$i++)$pairs[]=array_merge($metrics[$i],$metrics[$i+$half]??['','']);
  $html='<h2>At a glance</h2>'.self::table(['Metric','Value','Metric','Value'],$pairs).'<p class="note">Current period. Cancelled orders excluded from item and customer value metrics. Durations use completed event pairs.</p>';
  foreach(['payment-trend'=>'Payment trend','orders-by-day'=>'Orders by day','demand'=>'When customers order','order-flow'=>'Order flow','locations'=>'Locations','fulfillment'=>'Fulfillment times','top-items'=>'Popular items'] as $target=>$title)$html.='<div class="panel"><h2>'.$title.'</h2>'.self::panel($data,$target).'</div>';
  $payments=[];foreach(['Payments'=>'captured','Refunds'=>'refunded','Net product payments'=>'netSales','Net delivery fees'=>'netDeliveryFees','Net tax'=>'netTax','Tips added'=>'orderedTips','Tips collected'=>'capturedTips','Tips refunded'=>'refundedTips','Net tips'=>'netTips'] as $label=>$key)$payments[]=[$label,$money($s[$key])];
  $html.='<div class="panel"><h2>Payment breakdown</h2>'.self::table(['Metric','Amount'],$payments).'<h2>Fulfillment</h2>'.self::table(['Type','Orders'],array_map(fn($v)=>[$v['fulfillment'],$v['count']],$r['fulfillment'])).'</div>';
  $html.='<div class="panel"><h2>All items</h2>'.self::table(['Item','Quantity','Ordered subtotal'],array_map(fn($v)=>[$v['name'].($v['option']?' · '.$v['option']:''),$v['quantity'],$money($v['orderedSubtotal'])],$r['items'])).'</div>';
  $html.='<div class="panel"><h2>Daily data</h2>'.self::table(['Date','Orders','Ordered','Payments','Refunds','Net payments','Tips added','Tips collected','Tips refunded','Net tips'],array_map(fn($v)=>[$v['date'],$v['orders'],$money($v['orderedValue']),$money($v['captured']),$money($v['refunded']),$money($v['netCollected']),$money($v['orderedTips']),$money($v['capturedTips']),$money($v['refundedTips']),$money($v['netTips'])],$r['daily'])).'</div>';
  return $html.'<div class="panel"><h2>Order times</h2>'.self::table(['Hour','Orders'],array_map(fn($v)=>[sprintf('%02d:00',$v['hour']),$v['count']],$r['hours'])).'</div>';
 }
 public static function make(array $data,string $business,string $target):array {
  if(!in_array($target,self::TARGETS,true))throw new ApiError('Choose a valid PDF report.');
  if(!class_exists(\Dompdf\Dompdf::class)){$autoload=dirname(__DIR__,2).'/vendor/autoload.php';if(is_file($autoload))require_once $autoload;}if(!class_exists(\Dompdf\Dompdf::class))throw new ApiError('PDF export is unavailable.',503);
  $titles=['at-a-glance'=>'Operational summary','all-items'=>'All items','daily'=>'Daily data','payments'=>'Payment breakdown','hours'=>'Order times','overview'=>'Overview','payment-trend'=>'Payment trend','orders-by-day'=>'Orders by day','demand'=>'When customers order','top-items'=>'Popular items','order-flow'=>'Order flow','locations'=>'Locations','fulfillment'=>'Fulfillment times'];$r=$data['current'];$title=$titles[$target];
  $content=$target==='overview'?self::overview($data):self::panel($data,$target);if($target==='overview')foreach($data['_mapPanels']??[] as $map)$content.='<div class="panel">'.$map.'</div>';
  $html='<html><head><meta charset="utf-8"><style>@page{margin:36px 36px 48px}.panel{page-break-before:always}h2{font-size:18px}body{font:10px DejaVu Sans;color:#17241c}h1{font-size:22px;margin:0 0 8px}.scope{font-size:10px;margin-bottom:22px}.note{font-size:8px;color:#526157}img{width:100%;height:auto}table{width:100%;border-collapse:collapse}th{background:#1d593b;color:white}td,th{padding:5px;border-bottom:1px solid #d5dfd8;text-align:left}tr{page-break-inside:avoid}.layout>tbody>tr>td,.layout>tr>td{border:0;padding:4px;vertical-align:middle}.layout table{font-size:8px}.layout table td,.layout table th{padding:5px}</style></head><body><h1>'.self::esc($title).'</h1>'.PdfIdentity::header($data,$business).'<p class="scope">'.self::esc($data['range']['from'].' to '.$data['range']['to'].' · '.$data['currency'].' · '.$data['fulfillment'].' · '.$data['timeZone']).'</p>'.$content.'<p class="note">'.self::esc(PdfIdentity::notes($data)).'</p></body></html>';
  $pdf=new \Dompdf\Dompdf(['isRemoteEnabled'=>false,'isPhpEnabled'=>false,'isJavascriptEnabled'=>false,'defaultFont'=>'DejaVu Sans']);$pdf->setPaper('letter',in_array($target,['demand','overview','daily'],true)?'landscape':'portrait');$pdf->loadHtml($html,'UTF-8');$pdf->render();$identity=PdfIdentity::footer($pdf,$data['timeZone']);
  return ['name'=>PdfIdentity::prefix($business).'-'.$target.'-'.$data['range']['from'].'-'.$data['range']['to'].'.pdf','type'=>'application/pdf','content'=>$pdf->output(),'identity'=>$identity];
 }
}
