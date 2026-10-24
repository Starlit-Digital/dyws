<?php
declare(strict_types=1);

function dyws_admin_orders(array $config,\dyws\Store $store):array {
 $drivers=[];foreach($config['drivers'] as $id=>$driver)if($driver['active']??true)$drivers[]=['id'=>$id,'name'=>$driver['name']];
 return ['orders'=>$store->orders(),'drivers'=>$drivers,'runs'=>(new \dyws\DeliveryRuns($store))->listing()];
}
function dyws_driver_locations(\dyws\Store $store):array {
 $orders=$store->query("SELECT o.id,o.driver_id,o.address FROM orders o LEFT JOIN delivery_run_stops ds ON ds.tenant=o.tenant AND ds.order_id=o.id AND ds.active=1 WHERE o.tenant=? AND o.status='out_for_delivery' AND o.driver_id IS NOT NULL ORDER BY o.driver_id,coalesce(ds.position,999),o.updated_at DESC",[$store->tenant]);
 return ['locations'=>array_map(fn($o)=>['driverId'=>$o['driver_id'],'orderId'=>$o['id'],'deliveryAddress'=>$o['address'],'gps'=>$store->locationSummary($o['id'])],$orders)];
}
function dyws_admin_report(array $config,\dyws\Store $store,\dyws\Plugins $plugins,array $query):array {
 $tz=new DateTimeZone((new \dyws\Settings($config))->read()['timeZone']);$start=$query['from']??(new DateTimeImmutable('today',$tz))->format('Y-m-d');$end=$query['to']??$start;
 if(!is_string($start)||!is_string($end))throw new \dyws\ApiError('Choose valid report dates.');
 $from=DateTimeImmutable::createFromFormat('!Y-m-d',$start,$tz);$to=DateTimeImmutable::createFromFormat('!Y-m-d',$end,$tz);
 if(!$from||!$to||$from->format('Y-m-d')!==$start||$to->format('Y-m-d')!==$end||$to<$from||(int)$from->diff($to)->format('%a')>365)throw new \dyws\ApiError('Choose a valid date range up to one year.');
 // Plugin report filters use the request query, including when rendering the first page.
 $previous=$_GET;$_GET=$query;
 try{return $plugins->applyFilters('reports.summary',$store->reports($from->getTimestamp(),$to->modify('+1 day')->getTimestamp()));}finally{$_GET=$previous;}
}
function dyws_admin_data(array $config,\dyws\Store $store,string $page):array {
 $started=microtime(true);$plugins=new \dyws\Plugins($config,$config['plugins_path']??null,$store);$store->plugins=$plugins;
 $settings=(new \dyws\Settings($config))->read();
 $boot=['page'=>$page,'responses'=>['/settings'=>$settings,'/plugins'=>$plugins->publicManifest($page)],'realtime'=>(new \dyws\Realtime($config,$store))->publicConfig()];
 if($page==='orders')$boot['responses']['/manager/orders']=dyws_admin_orders($config,$store);
 if(in_array($page,['catalog','settings'],true)){$catalog=\dyws\Catalog::load($config['catalog']);$boot['responses']['/manager/catalog']=['catalog'=>$catalog,'revision'=>\dyws\Catalog::revision($catalog)];}
 if($page==='settings')$boot['responses']['/manager/settings']=(new \dyws\Settings($config))->summary();
 if($page==='drivers'){
  $boot['responses']['/manager/drivers']=(new \dyws\AdminAccounts($config))->summary($store);
  $boot['responses']['/manager/driver-locations']=dyws_driver_locations($store);
 }
 if($page==='plugins')$boot['responses']['/manager/plugins']=$plugins->summary();
 if($page==='reports'){
  $today=new DateTimeImmutable('today',new DateTimeZone($settings['timeZone']));
  $boot['reportQuery']=['from'=>$today->modify('-29 days')->format('Y-m-d'),'to'=>$today->format('Y-m-d'),'fulfillment'=>'all'];
  $boot['responses']['/manager/reports']=dyws_admin_report($config,$store,$plugins,$boot['reportQuery']);
 }
 $routes=$page==='settings'?['/manager/plugins/google-maps/settings','/manager/plugins/stripe/settings']:[];
 if(in_array($page,['orders','drivers'],true))$routes[]='/plugins/google-maps/config';
 foreach($routes as $route){$matched=$plugins->match('GET',$route);if(!$matched)continue;
  try{$boot['responses'][$route]=($matched['handler'])([],['role'=>'manager','subject'=>'manager','tenant'=>$store->tenant],['raw'=>'','params'=>$matched['params'],'server'=>$_SERVER]);}catch(\Throwable $e){/* The plugin reports its own error when refreshed. */}
 }
 foreach($boot['responses'] as $route=>$data)$boot['responses'][$route]=$plugins->applyFilters('api.response',$data,$route,'GET');
 header('Server-Timing: app;dur='.round((microtime(true)-($_SERVER['REQUEST_TIME_FLOAT']??microtime(true)))*1000,2).', initial_data;dur='.round((microtime(true)-$started)*1000,2));
 return $boot;
}
function dyws_admin_initial_head(array $boot,string $publicRoot,string $prefix='../'):string {
 $html='<meta name="dyws-admin-data" content="'.htmlspecialchars(json_encode($boot,JSON_THROW_ON_ERROR|JSON_UNESCAPED_SLASHES),ENT_QUOTES,'UTF-8').'">';
 $html.=dyws_requires_meta($boot['page']);
 $html.=dyws_style_preloads($prefix);
 foreach($boot['responses']['/plugins']['plugins'] as $plugin)if($plugin['stylesheet']??null)$html.='<link rel="stylesheet" data-dyws-plugin-style="'.htmlspecialchars($plugin['id'],ENT_QUOTES,'UTF-8').'" href="'.$prefix.'plugins/'.htmlspecialchars($plugin['id'].'/'.$plugin['stylesheet'].'?v='.$plugin['version'],ENT_QUOTES,'UTF-8').'">';
 $file=$publicRoot.'/platform/preloads.json';if(!is_file($file))return $html;
 $preloads=json_decode(file_get_contents($file),true,64,JSON_THROW_ON_ERROR);$urls=$preloads['pages'][$boot['page']]??[];
 foreach($boot['responses']['/plugins']['plugins'] as $plugin)$urls=array_merge($urls,$preloads['plugins'][$plugin['id']]??[]);
 foreach($boot['responses']['/plugins']['plugins'] as $plugin)foreach($preloads['styles'][$plugin['id']]??[] as $url)$html.='<link rel="preload" as="style" href="'.$prefix.htmlspecialchars($url,ENT_QUOTES,'UTF-8').'">';
 if($boot['page']==='storefront')$html.='<link rel="preload" as="style" href="'.$prefix.'dyws/ordering.css?v=43">';
 foreach(array_unique($urls) as $url)$html.='<link rel="modulepreload" href="'.$prefix.htmlspecialchars($url,ENT_QUOTES,'UTF-8').'">';
 return $html;
}
function dyws_admin_navigation(array $config,array $boot):string {
 $pages=['orders'=>'Orders','reports'=>'Reports','catalog'=>'Catalog','drivers'=>$boot['responses']['/settings']['driverRole']['plural'],'password'=>'Password','settings'=>'Settings','plugins'=>'Plugins'];$html='';
 foreach($pages as $id=>$label){$href=dyws_admin_base($config).'/'.$id.'/'.(($_GET['diagnostics']??'')==='1'?'?diagnostics=1':'');$html.='<a href="'.htmlspecialchars($href,ENT_QUOTES,'UTF-8').'"'.($id===$boot['page']?' aria-current="page"':'').'>'.htmlspecialchars($label,ENT_QUOTES,'UTF-8').'</a>';}
 return $html;
}
function dyws_admin_initial_orders(array $boot):string {
 $rows=$boot['responses']['/manager/orders']['orders']??[];$html='<div data-dyws-order-initial class="dyws-table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Total</th></tr></thead><tbody>';$count=0;
 foreach($rows as $order){if(in_array($order['status'],['completed','delivered','cancelled'],true))continue;$count++;
  $html.='<tr>';foreach([$order['id'],$order['customer_name'],str_replace('_',' ',$order['status']),$order['currency'].' '.number_format($order['total']/100,2)]as $cell)$html.='<td>'.htmlspecialchars($cell,ENT_QUOTES,'UTF-8').'</td>';$html.='</tr>';}
 if(!$count)$html.='<tr><td colspan="4">No active orders.</td></tr>';return $html.'</tbody></table></div>';
}
function dyws_admin_plugin_forms(array $boot,string $publicRoot):void {
 $dywsInlineSettings=true;
 foreach($boot['responses']['/plugins']['plugins'] as $plugin)if(in_array($plugin['id'],['google-maps','stripe'],true))include $publicRoot.'/plugins/'.$plugin['id'].'/settings.php';
}
function dyws_admin_preview(array $boot):string {
 $escape=static fn($value)=>htmlspecialchars((string)$value,ENT_QUOTES,'UTF-8');$page=$boot['page'];$html='';
 if($page==='reports'){$r=$boot['responses']['/manager/reports'];$html='<div class="dyws-stats">';foreach(['Orders'=>$r['orderCount'],'Active orders'=>$r['activeOrders'],'Cancelled'=>$r['cancelledOrders'],'Ordered value'=>$r['currency'].' '.number_format($r['orderedValue']/100,2)] as $label=>$value)$html.='<div class="dyws-stat">'.$escape($label).'<strong>'.$escape($value).'</strong></div>';$html.='</div>';}
 if($page==='catalog')foreach($boot['responses']['/manager/catalog']['catalog']['categories'] as $category){$html.='<h2>'.$escape($category['name']).'</h2><ul>';foreach($category['items'] as $item)$html.='<li>'.$escape($item['name']).' · '.number_format($item['price']/100,2).'</li>';$html.='</ul>';}
 if($page==='drivers')foreach($boot['responses']['/manager/drivers']['drivers'] as $driver)$html.='<article><h2>'.$escape($driver['name']).'</h2><p>'.($driver['active']?'Active':'Inactive').' · '.(int)$driver['activeOrders'].' active orders</p></article>';
 if($page==='plugins')foreach($boot['responses']['/manager/plugins']['plugins'] as $plugin)$html.='<p><strong>'.$escape($plugin['name']).'</strong> · '.($plugin['active']?'Enabled':'Disabled').'</p>';
 return $html!==''?'<section data-dyws-initial-preview>'.$html.'</section>':'';
}

function dyws_style_preloads(string $prefix='../'):string {
 $html='';foreach(['tokens.css?v=22','catalog.css?v=22','admin.css?v=29','tracking.css?v=28'] as $css)$html.='<link rel="preload" as="style" href="'.$prefix.'dyws/'.$css.'">';return $html;
}

function dyws_requires_meta(string $page):string {
 return '<meta name="dyws-page-manifest" content="'.htmlspecialchars(json_encode(\dyws\PageManifest::forPage($page),JSON_THROW_ON_ERROR),ENT_QUOTES,'UTF-8').'">';
}
