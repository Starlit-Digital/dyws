<?php
declare(strict_types=1);
namespace dyws\Plugins\OrderReporting;
use DateTimeImmutable;
use DateTimeZone;
use dyws\{Store,ApiError,Tips};

/** Aggregate private order snapshots and ledger events, without contacts or location data. */
final class OrderReports {
 public const TIMEZONE='America/Edmonton';
 public function __construct(private Store $store,private string $timeZone=self::TIMEZONE) {}
 public static function range(array $query,string $timeZone=self::TIMEZONE):array {
  $tz=new DateTimeZone($timeZone);$today=new DateTimeImmutable('today',$tz);
  $start=$query['from']??$today->modify('-29 days')->format('Y-m-d');$end=$query['to']??$today->format('Y-m-d');
  $parse=static function($date)use($tz){if(!is_string($date)||!preg_match('/^\d{4}-\d{2}-\d{2}$/D',$date))throw new ApiError('Choose valid report dates.');$d=DateTimeImmutable::createFromFormat('!Y-m-d',$date,$tz);if(!$d||$d->format('Y-m-d')!==$date)throw new ApiError('Choose valid report dates.');return $d;};
  $from=$parse($start);$to=$parse($end);
  if($to<$from||(int)$from->diff($to)->format('%a')>365)throw new ApiError('Choose a range of at most 366 days.');
  return [$from->getTimestamp(),$to->modify('+1 day')->getTimestamp()];
 }
 public function dashboard(int $from,int $to,string $currency,array $query=[]):array {
  $currency=$query['currency']??$currency;$fulfillment=$query['fulfillment']??'all';
  if(!is_string($currency)||!preg_match('/^[A-Z]{3}$/D',$currency)||!in_array($fulfillment,['all','pickup','delivery'],true))throw new ApiError('Choose a valid currency and fulfilment filter.');
  $tz=new DateTimeZone($this->timeZone);$start=(new DateTimeImmutable('@'.$from))->setTimezone($tz);$end=(new DateTimeImmutable('@'.$to))->setTimezone($tz);
  $days=(int)$start->diff($end)->format('%a');if($days<1||$days>366)throw new ApiError('Choose a range of at most 366 days.');
  $previousStart=$start->modify('-'.$days.' days')->getTimestamp();
  // A deferred read transaction gives all panels the same SQLite snapshot without reserving a write lock.
  $own=!$this->store->db->inTransaction();if($own)$this->store->db->beginTransaction();
  try {
   $current=$this->aggregate($from,$to,$currency,$fulfillment);$previous=$this->aggregate($previousStart,$from,$currency,$fulfillment);
   $currencies=array_column($this->store->query('SELECT DISTINCT currency FROM orders WHERE tenant=? ORDER BY currency',[$this->store->tenant]),'currency');if(!in_array($currency,$currencies,true))$currencies[]=$currency;sort($currencies);
   if($own)$this->store->db->commit();
  }catch(\Throwable $e){if($own&&$this->store->db->inTransaction())$this->store->db->rollBack();throw $e;}
  $context=['from'=>$from,'to'=>$to,'currency'=>$currency,'fulfillment'=>$fulfillment,'timeZone'=>$this->timeZone];
  $data=['schemaVersion'=>1,'demo'=>true,'currency'=>$currency,'currencies'=>$currencies,'fulfillment'=>$fulfillment,'timeZone'=>$this->timeZone,'range'=>['from'=>$start->format('Y-m-d'),'to'=>$end->modify('-1 day')->format('Y-m-d'),'days'=>$days],'previousRange'=>['from'=>$start->modify('-'.$days.' days')->format('Y-m-d'),'to'=>$start->modify('-1 day')->format('Y-m-d')],'current'=>$current,'previous'=>$previous['summary']];
  $data=$this->store->plugins?->applyFilters('reports.dataset',$data,$context)??$data;
  $this->store->plugins?->doAction('reports.generated',$data,$context);
  return $data;
 }
 private function aggregate(int $from,int $to,string $currency,string $fulfillment):array {
  $s=$this->store;$tz=new DateTimeZone($this->timeZone);$date=static fn(int $t)=>(new DateTimeImmutable('@'.$t))->setTimezone($tz);
  $daily=[];for($d=$date($from);$d->getTimestamp()<$to;$d=$d->modify('+1 day'))$daily[$d->format('Y-m-d')]=['date'=>$d->format('Y-m-d'),'orders'=>0,'orderedValue'=>0,'captured'=>0,'refunded'=>0,'netCollected'=>0,'orderedTips'=>0,'capturedTips'=>0,'refundedTips'=>0,'netTips'=>0];
  $summary=array_fill_keys(['orders','active','completed','cancelled','orderedValue','averageOrder','unpaidOrders','unpaidValue','captured','refunded','netCollected','netSales','netTax','netDeliveryFees','orderedTips','capturedTips','refundedTips','netTips','cancelledValue','units','customers','newCustomers','returningCustomers','repeatCustomers','averageCustomerValue','averageDeliveryFee'],0);
  $summary+=['completionRate'=>null,'cancellationRate'=>null,'preparationSeconds'=>null,'deliverySeconds'=>null,'preparationSamples'=>0,'deliverySamples'=>0,'repeatCustomerRate'=>null,'itemsPerOrder'=>null,'refundRate'=>null];
  $args=[$s->tenant,$currency,$from,$to];$where='o.tenant=? AND o.currency=? AND o.created_at>=? AND o.created_at<?';if($fulfillment!=='all'){$where.=' AND o.fulfillment=?';$args[]=$fulfillment;}
  $orders=$s->query("SELECT o.id,o.status,o.payment_status,o.fulfillment,o.total,o.delivery_fee,o.tip,o.customer_phone,o.order_location_json,o.lines_json,o.created_at FROM orders o WHERE $where ORDER BY o.created_at,o.id",$args);
  $statuses=array_fill_keys(['placed','accepted','preparing','ready','out_for_delivery','delivered','completed','cancelled'],0);$mix=['pickup'=>0,'delivery'=>0];$hours=array_fill(0,24,0);$items=[];$locations=[];$customers=[];$heatmap=array_fill(0,7,array_fill(0,24,0));$deliveryFees=0;$deliveryOrders=0;
  $identity=static function(string $phone):string {$digits=preg_replace('/[^0-9]/','',$phone);if(strlen($digits)===11&&$digits[0]==='1')$digits=substr($digits,1);return hash('sha256',$digits);};
  $historyArgs=[$s->tenant,$currency,$from];$historyWhere="tenant=? AND currency=? AND created_at<? AND status!='cancelled'";if($fulfillment!=='all'){$historyWhere.=' AND fulfillment=?';$historyArgs[]=$fulfillment;}
  $known=[];foreach($s->query('SELECT DISTINCT customer_phone FROM orders WHERE '.$historyWhere,$historyArgs) as $row)$known[$identity($row['customer_phone'])]=true;
  foreach($orders as $o){
   $summary['orders']++;$statuses[$o['status']]=($statuses[$o['status']]??0)+1;$mix[$o['fulfillment']]++;$hours[(int)$date((int)$o['created_at'])->format('G')]++;
   $local=$date((int)$o['created_at']);$heatmap[(int)$local->format('N')-1][(int)$local->format('G')]++;
   $branch=json_decode($o['order_location_json'],true)?:[];$branchId=$branch['id']??'';
   if(!isset($locations[$branchId]))$locations[$branchId]=['id'=>$branchId,'name'=>$branch['name']??'Business','orders'=>0,'cancelled'=>0,'orderedValue'=>0,'averageOrder'=>0];
   $locations[$branchId]['name']=$branch['name']??'Business';$locations[$branchId]['orders']++;
   $key=$date((int)$o['created_at'])->format('Y-m-d');$daily[$key]['orders']++;
   if($o['status']==='cancelled'){$summary['cancelled']++;$summary['cancelledValue']+=(int)$o['total'];$locations[$branchId]['cancelled']++;continue;}
   if(in_array($o['status'],['completed','delivered'],true))$summary['completed']++;else $summary['active']++;
   $locations[$branchId]['orderedValue']+=(int)$o['total'];$customerKey=$identity($o['customer_phone']);$customers[$customerKey]=($customers[$customerKey]??0)+1;
   if($o['fulfillment']==='delivery'){$deliveryOrders++;$deliveryFees+=(int)$o['delivery_fee'];}
   $summary['orderedTips']+=(int)$o['tip'];$daily[$key]['orderedTips']+=(int)$o['tip'];$summary['orderedValue']+=(int)$o['total'];$daily[$key]['orderedValue']+=(int)$o['total'];
   if($o['payment_status']==='unpaid'){$summary['unpaidOrders']++;$summary['unpaidValue']+=(int)$o['total'];}
   foreach(json_decode($o['lines_json'],true,64,JSON_THROW_ON_ERROR) as $line){$itemKey=json_encode([$line['id'],$line['variant']]);if(!isset($items[$itemKey]))$items[$itemKey]=['id'=>$line['id'],'variant'=>$line['variant'],'name'=>$line['name'],'option'=>$line['option'],'quantity'=>0,'orderedSubtotal'=>0];$summary['units']+=(int)$line['quantity'];$items[$itemKey]['quantity']+=(int)$line['quantity'];$items[$itemKey]['orderedSubtotal']+=(int)$line['quantity']*(int)$line['price']-(int)($line['discount']??0);}
  }
  $nonCancelled=$summary['orders']-$summary['cancelled'];$summary['averageOrder']=$nonCancelled?(int)round($summary['orderedValue']/$nonCancelled):0;
  if($summary['orders']){$summary['completionRate']=round(100*$summary['completed']/$summary['orders'],1);$summary['cancellationRate']=round(100*$summary['cancelled']/$summary['orders'],1);}
  $summary['customers']=count($customers);
  foreach($customers as $id=>$count){if(isset($known[$id]))$summary['returningCustomers']++;else $summary['newCustomers']++;if(isset($known[$id])||$count>1)$summary['repeatCustomers']++;}
  $summary['repeatCustomerRate']=$customers?round(100*$summary['repeatCustomers']/count($customers),1):null;
  $summary['averageCustomerValue']=$customers?(int)round($summary['orderedValue']/count($customers)):0;
  $summary['averageDeliveryFee']=$deliveryOrders?(int)round($deliveryFees/$deliveryOrders):0;
  $summary['itemsPerOrder']=$nonCancelled?round($summary['units']/$nonCancelled,2):null;
  foreach($locations as &$location){$count=$location['orders']-$location['cancelled'];$location['averageOrder']=$count?(int)round($location['orderedValue']/$count):0;}unset($location);
  // Payment dates, not order dates. Delta refunds replace the legacy cumulative refund entry.
  $payArgs=[$s->tenant,$currency,$from,$to];$payWhere='p.tenant=? AND o.currency=? AND p.created_at>=? AND p.created_at<?';if($fulfillment!=='all'){$payWhere.=' AND o.fulfillment=?';$payArgs[]=$fulfillment;}
  $ledger=$s->query("SELECT p.kind,p.amount,p.created_at,o.subtotal,o.tax,o.delivery_fee,o.tip FROM payments p JOIN orders o ON o.id=p.order_id AND o.tenant=p.tenant WHERE $payWhere AND NOT(p.kind='refund' AND EXISTS(SELECT 1 FROM payment_refund_deltas d WHERE d.tenant=p.tenant AND d.order_id=p.order_id))",$payArgs);
  $ledger=array_merge($ledger,$s->query("SELECT 'refund' AS kind,p.amount,p.created_at,p.subtotal,p.tax,p.delivery_fee,p.tip FROM payment_refund_deltas p JOIN orders o ON o.id=p.order_id AND o.tenant=p.tenant WHERE $payWhere",$payArgs));
  foreach($ledger as $p){$amount=(int)$p['amount'];$capture=$p['kind']==='capture';$sign=$capture?1:-1;$metric=$capture?'captured':'refunded';$summary[$metric]+=$amount;$key=$date((int)$p['created_at'])->format('Y-m-d');$daily[$key][$metric]+=$amount;$daily[$key]['netCollected']+=$sign*$amount;$summary['netCollected']+=$sign*$amount;
   $parts=Tips::allocate($p,$amount);$summary['netSales']+=$sign*$parts['subtotal'];$summary['netDeliveryFees']+=$sign*$parts['delivery_fee'];$summary['netTax']+=$sign*$parts['tax'];$tipMetric=$capture?'capturedTips':'refundedTips';$summary[$tipMetric]+=$parts['tip'];$summary['netTips']+=$sign*$parts['tip'];$daily[$key][$tipMetric]+=$parts['tip'];$daily[$key]['netTips']+=$sign*$parts['tip'];
  }
  $summary['refundRate']=$summary['captured']?round(100*$summary['refunded']/$summary['captured'],1):null;
  foreach(['acceptance'=>['placed','accepted'],'preparation'=>['accepted','ready'],'delivery'=>['out_for_delivery','delivered']] as $metric=>$pair){
   $rows=$s->query("SELECT MIN(CASE WHEN e.status=? THEN e.created_at END) AS started,MIN(CASE WHEN e.status=? THEN e.created_at END) AS finished FROM events e JOIN orders o ON o.id=e.order_id AND o.tenant=e.tenant WHERE $where GROUP BY o.id",array_merge($pair,$args));$durations=[];
   foreach($rows as $row)if($row['started']!==null&&$row['finished']!==null&&$row['finished']>=$row['started'])$durations[]=(int)$row['finished']-(int)$row['started'];
   sort($durations);$count=count($durations);
   $summary[$metric.'MedianSeconds']=$count?(int)round(($durations[intdiv($count-1,2)]+$durations[intdiv($count,2)])/2):null;
   $summary[$metric.'P90Seconds']=$count?$durations[(int)ceil($count*.9)-1]:null;
   $summary[$metric.'Samples']=count($durations);$summary[$metric.'Seconds']=$durations?(int)round(array_sum($durations)/count($durations)):null;
  }
  usort($items,static fn($a,$b)=>($b['quantity']<=>$a['quantity'])?:strcmp($a['name'],$b['name']));
  return ['summary'=>$summary,'daily'=>array_values($daily),'statuses'=>array_map(static fn($key,$count)=>['status'=>$key,'count'=>$count],array_keys($statuses),$statuses),'fulfillment'=>array_map(static fn($key,$count)=>['fulfillment'=>$key,'count'=>$count],array_keys($mix),$mix),'hours'=>array_map(static fn($hour,$count)=>['hour'=>$hour,'count'=>$count],array_keys($hours),$hours),'items'=>array_values($items),'locations'=>array_values($locations),'heatmap'=>$heatmap];
 }
}
