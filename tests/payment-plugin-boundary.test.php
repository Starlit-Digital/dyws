<?php
declare(strict_types=1);
require __DIR__.'/../modules/dyws/php/module.php';
use dyws\{Store,Catalog,Plugins,ApiError};
$work=sys_get_temp_dir().'/dyws-payment-boundary-'.bin2hex(random_bytes(6));mkdir($work,0700);$checks=0;
function check($condition,$message){global $checks;if(!$condition)throw new RuntimeException($message);$checks++;}
function rejects(callable $fn,int $code){try{$fn();throw new RuntimeException('Expected rejection');}catch(ApiError $e){check($e->http===$code,$e->getMessage());}}
try{
 $config=['database'=>$work.'/orders.sqlite','tenant'=>'example-shop','tracking_secret'=>bin2hex(random_bytes(32))];$GLOBALS['dyws_config']=$config;
 $catalog=Catalog::load(__DIR__.'/../examples/general-store/catalog.json');$store=new Store($config['database'],$catalog,$config['tenant']);
 $host=new Plugins($config,null,$store);
 check(!in_array('stripe',array_column($host->summary()['plugins'],'id'),true),'Standard kit excludes the Stripe plugin');
 check($host->paymentProvider()==='demo','Fresh kit needs no payment plugin');
 check($host->match('POST','/plugins/stripe/webhook')===null,'No Stripe callback without installed plugin');
 // Old saved activation without capability metadata must not silently switch to manual orders.
 $state=$work.'/plugins-'.substr(hash('sha256',$config['tenant']),0,16).'.json';
 file_put_contents($state,json_encode(['active'=>['stripe'],'known'=>['stripe']]));
 rejects(fn()=>(new Plugins($config,null,$store))->paymentProvider(),503);
 unlink($state);
 $body=['idempotencyKey'=>bin2hex(random_bytes(16)),'customer'=>['name'=>'Example Shopper','phone'=>'7805550142'],'lines'=>[['id'=>'notebook','quantity'=>1]],'fulfillment'=>'pickup'];
 $receipt=$store->create($body,'external');$id=$receipt['id'];
 rejects(fn()=>$store->payment($id,'capture'),409);
 rejects(fn()=>$store->change($id,'accepted','manager'),409);
 $store->execute("INSERT INTO payment_attempts(tenant,order_id,nonce,status,amount,currency,created_at) VALUES(?,?,?,'pending',?,?,?)",[$config['tenant'],$id,'fixture-nonce',$receipt['total'],$receipt['currency'],time()]);
 rejects(fn()=>$store->change($id,'cancelled','manager'),409);
 foreach(['payment_attempts'=>'stripe_attempts','payment_events'=>'stripe_events','payment_refund_deltas'=>'stripe_refund_deltas'] as $new=>$old)$store->db->exec("ALTER TABLE $new RENAME TO $old");
 $upgraded=new Store($config['database'],$catalog,$config['tenant']);
 check($upgraded->tracking($id,$receipt['trackingToken'])['checkoutStatus']==='pending','Historical payment state survives without a provider plugin');
 check($upgraded->get($id)['payment_provider']==='external','Existing provider ownership is preserved');
 echo "Payment plugin boundary: $checks checks passed.\n";
}finally{unset($store,$upgraded,$host);foreach(glob($work.'/*') as $file)unlink($file);rmdir($work);}
