<?php
declare(strict_types=1);
require __DIR__.'/../server/Store.php';require __DIR__.'/../server/Catalog.php';
use dyws\{Store,Catalog,ApiError};
$dir=sys_get_temp_dir().'/dyws-products-'.bin2hex(random_bytes(6));mkdir($dir,0700);$checks=0;
function check($condition,$message){global $checks;if(!$condition)throw new RuntimeException($message);$checks++;}
function rejects(callable $fn,int $code=422){try{$fn();throw new RuntimeException('Expected rejection');}catch(ApiError $e){check($e->http===$code,'Wrong error: '.$e->getMessage());}}
function orderBody($id='notebook'):array{return ['idempotencyKey'=>bin2hex(random_bytes(16)),'customer'=>['name'=>'Example Customer','phone'=>'7805550142'],'lines'=>[['id'=>$id,'variant'=>'','quantity'=>1,'price'=>1]],'fulfillment'=>'delivery','address'=>'100 Example Avenue'];}
try{
 $catalog=Catalog::load(__DIR__.'/../examples/general-store/catalog.json');Catalog::write($dir.'/catalog.json',$catalog);
 check($catalog['itemOrderCap']===10,'Default item order cap');
 foreach([0,100,1.5,'10',false] as $cap){$bad=$catalog;$bad['itemOrderCap']=$cap;rejects(fn()=>Catalog::validate($bad));}
 foreach(['javascript:alert(1)','abc'] as $phone){$bad=$catalog;$bad['businessPhone']=$phone;rejects(fn()=>Catalog::validate($bad));}
 $bad=$catalog;$bad['businessEmail']='bad-address';rejects(fn()=>Catalog::validate($bad));
 check($catalog['businessName']==='The Example Shop','Nonfood business name');check($catalog['categories'][0]['items'][0]['image']['alt']==='Notebook example placeholder','Product image supported');
 $bad=$catalog;$bad['categories'][0]['items'][0]['price']=12.95;rejects(fn()=>Catalog::validate($bad));
 $bad=$catalog;$bad['categories'][0]['items'][0]['image']['src']='javascript:alert(1)';rejects(fn()=>Catalog::validate($bad));
 $bad=$catalog;$bad['categories'][0]['items'][]=$bad['categories'][0]['items'][0];rejects(fn()=>Catalog::validate($bad));
 $changed=$catalog;$changed['categories'][0]['items'][0]['active']=false;Catalog::save($dir.'/catalog.json',$changed,Catalog::revision($catalog));
 check(count(Catalog::publicData(Catalog::load($dir.'/catalog.json'))['categories'][0]['items'])===1,'Inactive products omitted publicly');rejects(fn()=>Catalog::save($dir.'/catalog.json',$catalog,Catalog::revision($catalog)),409);
 $config=['tracking_secret'=>bin2hex(random_bytes(32)),'database'=>$dir.'/orders.sqlite','tenant'=>'example-shop','public_base_url'=>'https://example.test/shop'];$GLOBALS['dyws_config']=$config;
 $disabledStore=new Store($config['database'],$changed,$config['tenant']);rejects(fn()=>$disabledStore->create(orderBody()));unset($disabledStore);
 $store=new Store($config['database'],$catalog,$config['tenant']);
 $capStore=new Store($config['database'],$catalog,'cap-checks');
 $atCap=orderBody();$atCap['lines'][0]['quantity']=10;check(isset($capStore->create($atCap)['id']),'Exact cap accepted');
 $tooMany=orderBody();$tooMany['lines'][0]['quantity']=11;rejects(fn()=>$capStore->create($tooMany));
 $options=orderBody();$options['lines']=[['id'=>'tote','variant'=>'natural','quantity'=>6],['id'=>'tote','variant'=>'navy','quantity'=>5]];rejects(fn()=>$capStore->create($options));
 $higher=$catalog;$higher['itemOrderCap']=12;$higherStore=new Store($config['database'],$higher,'higher-cap');check(isset($higherStore->create($tooMany)['id']),'Configured cap respected');
 check(count($capStore->query("SELECT id FROM orders WHERE tenant='cap-checks'"))===1,'Rejected quantities leave no orders');
 $receipt=$store->create(orderBody());$id=$receipt['id'];
 check($receipt['total']===1880,'Generic product price plus configured delivery fee and tax');
 check($receipt['paymentProvider']==='demo','Framework uses the demonstration ledger without a payment plugin');
 $lines=json_decode($store->get($id)['lines_json'],true);
 check($lines[0]['sku']==='NOTE-A5'&&$lines[0]['price']===1295,'Immutable product snapshot and authoritative price');
 echo "Catalog: $checks checks passed.\n";
}finally{unset($store,$disabledStore);foreach(glob($dir.'/*') as $file)unlink($file);rmdir($dir);}
