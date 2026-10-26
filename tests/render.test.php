<?php
declare(strict_types=1);
ob_start();require __DIR__.'/../modules/dyws/php/module.php';$output=ob_get_clean();
$checks=0;
function verify($ok,$message){global $checks;if(!$ok)throw new RuntimeException($message);$checks++;}
verify($output==='','Including the module must not emit HTML or start an API response');
$catalog=dyws_load_catalog(__DIR__.'/../examples/starlit-diner/catalog.json');
$menu=dyws_render_menu($catalog,['id'=>'menu']);
verify(substr_count($menu,'class="dyws-category"')===5,'Full menu has category panels');
verify(substr_count($menu,'class="dyws-product"')===35,'Full menu has all products');
$category=dyws_render_category($catalog,'breakfast');
verify(substr_count($category,'class="dyws-product"')===7&&!str_contains($category,'Apple Pie'),'A category call only renders its products');
$item=dyws_render_item($catalog,'sweet1');
verify(substr_count($item,'class="dyws-product"')===1&&str_contains($item,'Chocolate'),'An item call retains variants');
verify(str_contains($menu,'data-dyws-rendered')&&str_contains($menu,'data-dyws-action="add"')&&str_contains($menu,'disabled>Add'),'Server rendering exposes hydration hooks and disables checkout before JS loads');
$catalog['categories'][0]['items'][0]['active']=false;
verify(!str_contains(dyws_render_menu($catalog),'Sunrise Breakfast'),'Inactive products do not render');
try{dyws_render_item($catalog,'breakfast0');throw new RuntimeException('Inactive item rendered');}catch(InvalidArgumentException $e){verify(true,'Inactive item rejected');}
$catalog['categories'][0]['name']='<script>alert("category")</script>';
$catalog['categories'][0]['items'][1]['name']='<img src=x onerror=alert(1)>';
$escaped=dyws_render_menu($catalog,['id'=>'" onmouseover="bad']);
verify(!str_contains($escaped,'<script>')&&!str_contains($escaped,'<img src=x')&&str_contains($escaped,'&lt;script&gt;'),'Catalog content is escaped');
verify(str_contains($escaped,'id="&quot; onmouseover=&quot;bad"'),'Host attributes are escaped');
$catalog['categories'][0]['image']['src']='javascript:alert(1)';
try{dyws_render_menu($catalog);throw new RuntimeException('Unsafe image rendered');}catch(\dyws\ApiError $e){verify(true,'Invalid image URL rejected');}
$shop=dyws_load_catalog(__DIR__.'/../examples/general-store/catalog.json');$shop['currency']='USD';$shop['categories'][0]['items'][1]['variants'][0]['price']=2050;
verify(str_contains(dyws_render_item($shop,'tote'),'US$20.50'),'Initial price uses selected variant and catalog currency');
verify(!str_contains(dyws_render_menu($shop),'tracking_secret'),'Rendered catalog does not contain private config');
$hours=['enabled'=>true,'days'=>array_fill(0,7,['mode'=>'hours','open'=>'22:00','close'=>'02:00'])];
$published=$shop;$published['businessName']='<Example & Business>';$published['locationHours']=$hours;$published['orderingHours']=$hours;$published['acceptingOrders']=false;
$html=dyws_render_business_hours($published);
verify(str_contains($html,'Location hours')&&str_contains($html,'Ordering hours')&&str_contains($html,'next day'),'Published schedules distinguish location and order hours, including overnight periods');
verify(str_contains($html,'&lt;Example &amp; Business&gt;')&&!str_contains($html,'<Example & Business>'),'Published business names are escaped');
verify(str_contains($html,'temporarily paused'),'Storefront explains paused ordering');
verify(dyws_render_business_hours($shop)==='','Unconfigured schedules do not invent opening hours');
echo "PHP rendering: $checks checks passed.\n";
