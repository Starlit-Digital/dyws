<?php
declare(strict_types=1);
namespace dyws\Plugins\OrderReporting;
use dyws\ApiError;

/** The same scoped aggregate data powers downloads and email attachments. */
final class ReportExport {
 public const SECTIONS=['overview','daily','items','locations','operations'];
 public static function sections($value):array {
  if(!is_array($value)||!array_is_list($value)||!$value||count($value)>5||array_filter($value,fn($item)=>!is_string($item)||!in_array($item,self::SECTIONS,true)))throw new ApiError('Choose at least one valid report section.');
  return array_values(array_unique($value));
 }
 public static function metricUnit(string $key):string {
  if(str_ends_with($key,'Seconds'))return 'seconds';
  if(str_ends_with($key,'Rate'))return 'percent';
  if($key==='itemsPerOrder')return 'items per order';
  return in_array($key,['orderedValue','averageOrder','unpaidValue','captured','refunded','netCollected','netSales','netTax','netDeliveryFees','orderedTips','capturedTips','refundedTips','netTips','cancelledValue','averageCustomerValue','averageDeliveryFee'],true)?'cents':'count';
 }
 public static function label(string $key):string {return ucfirst(preg_replace('/([a-z0-9])([A-Z])/','$1 $2',$key));}
 public static function tables(array $data,array $sections):array {
  $r=$data['current'];$tables=[];
  if(in_array('overview',$sections,true))$tables['Overview']=[['Metric','Current','Previous','Units'],...array_map(fn($key)=>[self::label($key),$r['summary'][$key],$data['previous'][$key]??null,self::metricUnit($key)],array_keys($r['summary']))];
  if(in_array('daily',$sections,true))$tables['Daily trend']=[['Day','Orders','Ordered value (cents)','Payments (cents)','Refunds (cents)','Net payments (cents)','Tips added (cents)','Tips collected (cents)','Tips refunded (cents)','Net tips (cents)'],...array_map(fn($d)=>[$d['date'],$d['orders'],$d['orderedValue'],$d['captured'],$d['refunded'],$d['netCollected'],$d['orderedTips'],$d['capturedTips'],$d['refundedTips'],$d['netTips']],$r['daily'])];
  if(in_array('items',$sections,true))$tables['Items']=[['Item','Option','Quantity','Ordered subtotal (cents)'],...array_map(fn($i)=>[$i['name'],$i['option'],$i['quantity'],$i['orderedSubtotal']],$r['items'])];
  if(in_array('locations',$sections,true))$tables['Locations']=[['Location','Orders','Cancelled','Ordered value (cents)','Average order (cents)'],...array_map(fn($l)=>[$l['name'],$l['orders'],$l['cancelled'],$l['orderedValue'],$l['averageOrder']],$r['locations'])];
  if(in_array('operations',$sections,true)){
   $tables['Order flow']=[['Status','Orders'],...array_map(fn($s)=>[$s['status'],$s['count']],$r['statuses'])];
   $tables['Demand by weekday and hour']=[['Day','Hour','Orders']];
   foreach($r['heatmap'] as $day=>$hours)foreach($hours as $hour=>$count)$tables['Demand by weekday and hour'][]=[['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][$day],sprintf('%02d:00',$hour),$count];
  }
  return $tables;
 }
 public static function make(array $data,string $business,array $sections,string $format):array {
  if(!in_array($format,['pdf','csv','txt'],true))throw new ApiError('Choose PDF, CSV or text.');
  $sections=self::sections($sections);$tables=self::tables($data,$sections);
  $scope=$business.' | '.$data['range']['from'].' to '.$data['range']['to'].' | '.$data['currency'].' | '.$data['fulfillment'].' | '.$data['timeZone'];
  $notes='Demonstration data. Ordered value excludes cancelled orders. Payments use payment dates. Customer counts estimate people using normalized phone numbers, without exposing contact details. Repeat customers have an earlier order or multiple orders in this period. P90 is the time within which 90% of measured orders finished. Refund percentages may exceed 100% when refunds relate to earlier sales.';
  if($format==='csv'){
   $stream=fopen('php://temp','w+');$write=static function(array $row)use($stream):void {
    $row=array_map(static function($value){if(is_string($value)&&preg_match('/^[\s]*[=+@\-\t\r]/u',$value))return "'".$value;return $value??'';},$row);
    fputcsv($stream,$row,',','"','',"\r\n");
   };
   $write(['Report',$scope]);$write(['Comparison',$data['previousRange']['from'].' to '.$data['previousRange']['to']]);$write(['Definitions',$notes]);
   foreach($tables as $title=>$rows){$write([]);$write([$title]);foreach($rows as $row)$write($row);}
   rewind($stream);$content=stream_get_contents($stream);fclose($stream);$type='text/csv;charset=utf-8';
  }elseif($format==='txt'){
   $content=$scope."\nCompared with ".$data['previousRange']['from'].' to '.$data['previousRange']['to']."\n\n".$notes."\n";
   foreach($tables as $title=>$rows){$content.="\n".$title."\n";foreach($rows as $row)$content.=implode(' | ',array_map(fn($v)=>$v===null?'No data':str_replace(["\r","\n","\t"],' ',(string)$v),$row))."\n";}$type='text/plain;charset=utf-8';
  }else{
   $autoload=dirname(__DIR__,2).'/vendor/autoload.php';if(is_file($autoload))require_once $autoload;
   if(!extension_loaded('dom')||!extension_loaded('mbstring'))throw new ApiError('PDF export requires the PHP DOM and mbstring extensions.',503);
   if(!class_exists(\Dompdf\Dompdf::class))throw new ApiError('PDF export needs the installed reporting dependencies. Contact the site administrator.',503);
   $esc=static fn($v)=>htmlspecialchars((string)($v??'No data'),ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');
   // Keep cents in machine exports, but show familiar amounts in the owner PDF.
   foreach($tables as $title=>&$rows){
    foreach($rows as $i=>&$row){
     if($title==='Overview'&&$i>0){
      $unit=$row[3];foreach([1,2] as $column)if($row[$column]!==null){if($unit==='cents')$row[$column]=number_format($row[$column]/100,2);elseif($unit==='seconds')$row[$column]=round($row[$column]/60,1);}
      if($unit==='cents')$row[3]=$data['currency'];elseif($unit==='seconds'){$row[3]='minutes';$row[0]=str_replace(' Seconds','',$row[0]);}
     }elseif($title!=='Overview'){
      foreach($rows[0] as $column=>$header)if(str_contains((string)$header,'(cents)')&&$i>0)$row[$column]=number_format($row[$column]/100,2);
     }
    }unset($row);
    if($title!=='Overview')foreach($rows[0] as &$header)$header=str_replace('(cents)','('.$data['currency'].')',(string)$header);unset($header);
   }unset($rows);
   $html='<html><head><meta charset="utf-8"><style>@page{margin:36px 36px 44px}body{font:10px DejaVu Sans;color:#183240}h1{font-size:24px;margin:0 0 6px}h2{font-size:16px;margin:20px 0 8px}p{line-height:1.5}.note{font-size:8px;color:#52636d}table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}tr{page-break-inside:avoid}td,th{padding:6px;border-bottom:1px solid #dae2e6;word-wrap:break-word;text-align:left}th{background:#183240;color:white}img{width:100%;height:auto}.cards td{background:#eef5f4;padding:10px}.cards strong{font-size:19px}h2{page-break-after:avoid}</style></head><body><h1>Business performance</h1><p>'.$esc($scope).'<br>Compared with '.$esc($data['previousRange']['from']).' to '.$esc($data['previousRange']['to']).'</p><p class="note">'.$esc($notes).'</p>';
   if(in_array('overview',$sections,true)){
    $s=$data['current']['summary'];$html.='<table class="cards"><tr>';
    foreach(['Orders'=>$s['orders'],'Average order'=>number_format($s['averageOrder']/100,2).' '.$data['currency'],'Repeat customers'=>($s['repeatCustomerRate']===null?'No data':$s['repeatCustomerRate'].'%')] as $label=>$value)$html.='<td>'.$esc($label).'<br><strong>'.$esc($value).'</strong></td>';
    $html.='</tr></table>';
   }
   foreach($tables as $title=>$rows){
    $html.='<h2>'.$esc($title).'</h2>';
    if($title==='Demand by weekday and hour'){$html.='<img alt="Weekday and hour order counts" src="data:image/svg+xml;base64,'.base64_encode(self::heatmap($data['current']['heatmap'])).'"><p class="note">Each cell shows the number of orders. Hours use '.$esc($data['timeZone']).'.</p>';continue;}
    if($title==='Daily trend')$html.='<img alt="Orders by day" src="data:image/svg+xml;base64,'.base64_encode(self::chart($data['current']['daily'],'orders','date','Orders by day')).'">';
    if($title==='Locations'&&$data['current']['locations'])$html.='<img alt="Orders by location" src="data:image/svg+xml;base64,'.base64_encode(self::chart($data['current']['locations'],'orders','name','Orders by location')).'">';
    $headers=array_shift($rows);$html.='<table><thead><tr>';foreach($headers as $header)$html.='<th>'.$esc($header).'</th>';$html.='</tr></thead><tbody>';
    foreach($rows as $row){$html.='<tr>';foreach($row as $cell)$html.='<td>'.$esc($cell).'</td>';$html.='</tr>';}$html.='</tbody></table>';
   }
   $html.='</body></html>';
   $pdf=new \Dompdf\Dompdf(['isRemoteEnabled'=>false,'isPhpEnabled'=>false,'isJavascriptEnabled'=>false,'chroot'=>__DIR__,'defaultFont'=>'DejaVu Sans']);
   $pdf->setPaper('letter');$pdf->loadHtml($html,'UTF-8');$pdf->render();
   $pdf->getCanvas()->page_text(36,765,'DYWS | Page {PAGE_NUM} of {PAGE_COUNT}',null,8,[.3,.4,.45]);
   $content=$pdf->output();$type='application/pdf';
  }
  return ['name'=>'dyws-report-'.$data['range']['from'].'-'.$data['range']['to'].'.'.$format,'type'=>$type,'content'=>$content];
 }
 private static function heatmap(array $matrix):string {
  $max=max(1,...array_merge(...$matrix));$svg='<svg xmlns="http://www.w3.org/2000/svg" width="560" height="190"><rect width="560" height="190" fill="#fff"/>';
  foreach(range(0,23) as $hour)$svg.='<text x="'.(65+$hour*20).'" y="12" font-family="sans-serif" font-size="8" text-anchor="middle">'.sprintf('%02d',$hour).'</text>';
  foreach($matrix as $day=>$hours){$y=20+$day*23;$svg.='<text x="0" y="'.($y+13).'" font-family="sans-serif" font-size="9">'.['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][$day].'</text>';foreach($hours as $hour=>$count){$level=$count===0?0:min(4,(int)ceil($count/$max*4));$svg.='<rect x="'.(56+$hour*20).'" y="'.$y.'" width="18" height="20" fill="'.['#f0f3f4','#d0e8e5','#9ecfc8','#397b79','#183240'][$level].'"/><text x="'.(65+$hour*20).'" y="'.($y+13).'" text-anchor="middle" fill="'.($level>2?'#fff':'#183240').'" font-family="sans-serif" font-size="8">'.$count.'</text>';}}
  return $svg.'</svg>';
 }
 private static function chart(array $rows,string $key,string $label,string $title):string {
  $esc=static fn($v)=>htmlspecialchars((string)$v,ENT_QUOTES|ENT_XML1,'UTF-8');$maximum=max(1,...array_column($rows,$key));$count=count($rows);$width=500/max(1,$count);
  $svg='<svg xmlns="http://www.w3.org/2000/svg" width="560" height="200"><rect width="560" height="200" fill="#eef5f4"/><text x="15" y="20" font-family="sans-serif" font-size="12">'.$esc($title).'</text>';
  foreach($rows as $i=>$row){$height=130*$row[$key]/$maximum;$x=30+$i*$width;$svg.='<rect x="'.$x.'" y="'.(165-$height).'" width="'.max(.5,$width*.7).'" height="'.$height.'" fill="#397b79"/>';if(in_array($i,[0,(int)floor(($count-1)/2),$count-1],true))$svg.='<text x="'.$x.'" y="185" font-family="sans-serif" font-size="9" text-anchor="'.($i===$count-1?'end':'start').'">'.$esc(mb_strimwidth((string)$row[$label],0,24,'…')).'</text>';}
  return $svg.'<text x="5" y="42" font-family="sans-serif" font-size="9">'.$maximum.'</text></svg>';
 }
}
