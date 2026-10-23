<?php
declare(strict_types=1);
require __DIR__.'/../server/Store.php';require __DIR__.'/../server/Catalog.php';require __DIR__.'/../server/StripeSettings.php';require __DIR__.'/../server/StripePayments.php';require __DIR__.'/../vendor/autoload.php';
use StarlitGo\{Store,Catalog,StripeSettings,StripePayments,ApiError};
$dir=sys_get_temp_dir().'/starlit-products-'.bin2hex(random_bytes(6));mkdir($dir,0700);$checks=0;
function check($condition,$message){global $checks;if(!$condition)throw new RuntimeException($message);$checks++;}
function rejects(callable $fn,int $code=422){try{$fn();throw new RuntimeException('Expected rejection');}catch(ApiError $e){check($e->http===$code,'Wrong error: '.$e->getMessage());}}
function orderBody($id='notebook'):array{return ['idempotencyKey'=>bin2hex(random_bytes(16)),'customer'=>['name'=>'Example Customer','phone'=>'7805550142'],'lines'=>[['id'=>$id,'variant'=>'','quantity'=>1,'price'=>1]],'fulfillment'=>'delivery','address'=>'100 Example Avenue'];}
try{
 $catalog=Catalog::load(__DIR__.'/../examples/general-store/catalog.json');Catalog::write($dir.'/catalog.json',$catalog);
 check($catalog['businessName']==='The Example Shop','Nonfood business name');check($catalog['categories'][0]['items'][0]['image']['alt']==='Notebook example placeholder','Product image supported');
 $bad=$catalog;$bad['categories'][0]['items'][0]['price']=12.95;rejects(fn()=>Catalog::validate($bad));
 $bad=$catalog;$bad['categories'][0]['items'][0]['image']['src']='javascript:alert(1)';rejects(fn()=>Catalog::validate($bad));
 $bad=$catalog;$bad['categories'][0]['items'][]=$bad['categories'][0]['items'][0];rejects(fn()=>Catalog::validate($bad));
 $changed=$catalog;$changed['categories'][0]['items'][0]['active']=false;Catalog::save($dir.'/catalog.json',$changed,Catalog::revision($catalog));
 check(count(Catalog::publicData(Catalog::load($dir.'/catalog.json'))['categories'][0]['items'])===1,'Inactive products omitted publicly');rejects(fn()=>Catalog::save($dir.'/catalog.json',$catalog,Catalog::revision($catalog)),409);
 $config=['tracking_secret'=>bin2hex(random_bytes(32)),'database'=>$dir.'/orders.sqlite','tenant'=>'example-shop','public_base_url'=>'https://example.test/shop','payment_provider'=>'stripe'];$GLOBALS['starlit_config']=$config;
 $disabledStore=new Store($config['database'],$changed,$config['tenant']);rejects(fn()=>$disabledStore->create(orderBody()));unset($disabledStore);
 $store=new Store($config['database'],$catalog,$config['tenant']);$settings=new StripeSettings($config);
 check(!$settings->summary()['enabled'],'Stripe starts disabled');
 $key='rk_test_'.bin2hex(random_bytes(16));$secret='whsec_'.bin2hex(random_bytes(16));
 rejects(fn()=>$settings->save(['enabled'=>true,'apiKey'=>'rk_live_'.bin2hex(random_bytes(16))]));
 rejects(fn()=>$settings->save(['enabled'=>true,'apiKey'=>$key]));
 $summary=$settings->save(['enabled'=>true,'apiKey'=>$key,'webhookSecret'=>$secret]);
 check($summary['hasApiKey']&&!isset($summary['apiKey']),'Manager reads no secret');check(!str_contains(file_get_contents($dir.'/stripe.json'),$key),'Credentials encrypted at rest');
 $settings->save(['enabled'=>true,'apiKey'=>'','webhookSecret'=>'']);check($settings->read()['apiKey']===$key,'Blank key preserves credentials');
 $receipt=$store->create(orderBody(),'stripe');$id=$receipt['id'];$token=$receipt['trackingToken'];check($receipt['total']===1880,'Generic product price plus configured delivery fee and tax');check($receipt['paymentProvider']==='stripe','Provider snapshotted');
 $o=$store->get($id);$lines=json_decode($o['lines_json'],true);check($lines[0]['sku']==='NOTE-A5'&&$lines[0]['price']===1295,'Immutable product snapshot and authoritative price');
 $calls=0;$params=null;
 $stripe=new StripePayments($store,$config,$settings,function($p,$key)use(&$calls,&$params){$calls++;$params=$p;return ['id'=>'cs_test_session','url'=>'https://checkout.stripe.com/c/pay/example'];});
 rejects(fn()=>$stripe->checkout($id,'wrong'),404);
 $url=$stripe->checkout($id,$token);check($url===$stripe->checkout($id,$token)&&$calls===1,'Checkout reuse prevents duplicate sessions');
 check(!isset($params['payment_method_types'])&&$params['mode']==='payment','Hosted Checkout with dynamic methods');
 check(array_sum(array_map(fn($i)=>$i['quantity']*$i['price_data']['unit_amount'],$params['line_items']))===1880,'Stripe amount equals immutable order total');
 rejects(fn()=>$store->payment($id,'capture'),409);rejects(fn()=>$store->change($id,'accepted','manager'),409);rejects(fn()=>$store->change($id,'cancelled','manager'),409);
 $obj=['id'=>'cs_test_session','client_reference_id'=>$id,'metadata'=>$params['metadata'],'amount_total'=>1880,'currency'=>'cad','payment_status'=>'unpaid','payment_intent'=>'pi_example'];
 $event=['id'=>'evt_pending','type'=>'checkout.session.completed','livemode'=>false,'data'=>['object'=>$obj]];
 $stripe->process($event);check($store->get($id)['payment_status']==='unpaid','Async pending does not mark paid');
 $event['id']='evt_paid';$event['type']='checkout.session.async_payment_succeeded';$event['data']['object']['payment_status']='paid';
 $bad=$event;$bad['data']['object']['amount_total']=1;rejects(fn()=>$stripe->process($bad),409);
 $bad=$event;$bad['data']['object']['metadata']['tenant']='another-shop';rejects(fn()=>$stripe->process($bad),400);
 $bad=$event;$bad['livemode']=true;rejects(fn()=>$stripe->process($bad),400);
 $raw=json_encode($event);$signature='t='.time().',v1='.hash_hmac('sha256',time().'.'.$raw,$secret);
 rejects(fn()=>$stripe->webhook($raw,'t='.time().',v1=invalid'),400);
 $old=time()-301;rejects(fn()=>$stripe->webhook($raw,'t='.$old.',v1='.hash_hmac('sha256',$old.'.'.$raw,$secret)),400);
 $stripe->webhook($raw,$signature);$stripe->webhook($raw,$signature);
 check(count($store->query('SELECT * FROM payments'))===1&&$store->get($id)['payment_status']==='paid','Signed duplicate delivery captured once');
 $event['id']='evt_paid_second';$stripe->process($event);check(count($store->query('SELECT * FROM payments'))===1,'Different payment event does not double count');
 $event['id']='evt_late_failed';$event['type']='checkout.session.async_payment_failed';$event['data']['object']['payment_status']='unpaid';$stripe->process($event);check($store->tracking($id,$token)['checkoutStatus']==='paid','Late failure does not downgrade paid');
 $refund=['id'=>'evt_refund_one','type'=>'charge.refunded','livemode'=>false,'data'=>['object'=>['payment_intent'=>'pi_example','currency'=>'cad','amount'=>1880,'amount_refunded'=>500]]];$stripe->process($refund);
 check($store->get($id)['payment_status']==='partially_refunded','Partial refund state');$r=$store->reports(time()-60,time()+60);check($r['netCollected']===1380&&$r['netSales']+$r['netTax']+$r['netDeliveryFees']===1380,'Partial refund reports reconcile');
 $refund['id']='evt_refund_full';$refund['data']['object']['amount_refunded']=1880;$stripe->process($refund);$stripe->process($refund);check($store->reports(time()-60,time()+60)['netCollected']===0,'Full refund once');
 $refund['id']='evt_refund_old';$refund['data']['object']['amount_refunded']=500;$stripe->process($refund);check($store->reports(time()-60,time()+60)['netCollected']===0,'Older refund cannot reverse a later refund');
 $r=$store->reports(time()-60,time()+60);check($r['netSales']===0&&$r['netTax']===0&&$r['netDeliveryFees']===0,'Full refund reconciles every component after partial refunds');
 $store->execute('UPDATE payment_refund_deltas SET created_at=? WHERE event_id=?',[time()-3600,'evt_refund_one']);check($store->reports(time()-60,time()+60)['refunded']===1380,'Refund report retains individual event dates');
 // An existing pre plugin database retains every payment row during its atomic upgrade.
 foreach(['payment_attempts'=>'stripe_attempts','payment_events'=>'stripe_events','payment_refund_deltas'=>'stripe_refund_deltas'] as $new=>$old)$store->db->exec("ALTER TABLE $new RENAME TO $old");
 $upgraded=new Store($config['database'],$catalog,$config['tenant']);
 check($upgraded->tracking($id,$token)['checkoutStatus']==='paid','Legacy attempt survives schema upgrade');
 check(count($upgraded->query('SELECT * FROM payment_events'))>=4,'Webhook deduplication survives schema upgrade');
 check($upgraded->reports(time()-60,time()+60)['refunded']===1380,'Refund history survives upgrade');
 unset($upgraded);
 echo "Catalog and Stripe: $checks checks passed.\n";
}finally{unset($store,$disabledStore,$stripe);foreach(glob($dir.'/*') as $file)unlink($file);rmdir($dir);}
