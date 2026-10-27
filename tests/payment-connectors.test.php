<?php
declare(strict_types=1);
require __DIR__.'/../modules/dyws/php/module.php';
use dyws\{Plugins,ApiError};
$work=sys_get_temp_dir().'/dyws-connectors-'.bin2hex(random_bytes(5));mkdir($work,0700);$config=['database'=>$work.'/test.sqlite','tenant'=>'connector-test','tracking_secret'=>str_repeat('x',64),'public_base_url'=>'https://example.test/shop'];$checks=0;
function check($v,$message){global $checks;if(!$v)throw new RuntimeException($message);$checks++;}
function denied($fn,$code){try{$fn();throw new RuntimeException('Expected failure');}catch(ApiError $e){check($e->http===$code,$e->getMessage());}}
try{
 $ids=['square'=>'Square','paypal'=>'PayPal','helcim'=>'Helcim','clover'=>'Clover','moneris'=>'Moneris','authorize-net'=>'AuthorizeNet'];
 $plugins=new Plugins($config);
 foreach($ids as $id=>$namespace){
  require_once __DIR__.'/../plugins/'.$id.'/Connector.php';$definition=json_decode(file_get_contents(__DIR__.'/../plugins/'.$id.'/connector.json'),true);$class='dyws\\Plugins\\'.$namespace.'\\Connector';$calls=[];
  $fake=function($method,$url,$headers,$body,$form)use(&$calls,$id){$calls[]=compact('method','url','headers','body','form');if(str_ends_with($url,'/token'))return ['access_token'=>'oauth-test'];return match($id){'square'=>['locations'=>[['id'=>'location-test','status'=>'ACTIVE']]],'clover'=>['id'=>'merchant-test'],'moneris'=>['response'=>['success'=>'true','ticket'=>'ticket-test']],'authorize-net'=>['messages'=>['resultCode'=>'Ok']],default=>[]};};
  $connector=new $class($config,$definition,$fake);$initial=$connector->summary();check(!$initial['configured']&&!$initial['checkoutEnabled'],'Fresh inactive connection');denied(fn()=>$connector->verify(),409);
  $credentials=[];foreach($definition['fields'] as $f)$credentials[$f['id']]='secret-'.$f['id'];$credentials['locationId']='location-test';$credentials['merchantId']='merchant-test';$credentials['webhookSecret']=base64_encode('webhook-test-key');$credentials['signatureKey']=str_repeat('AB',64);
  $credentials=array_intersect_key($credentials,array_column($definition['fields'],null,'id'));
  $saved=$connector->save(['credentials'=>$credentials,'revision'=>$initial['revision']]);check($saved['configured'],'Configured');check(!str_contains(json_encode($saved),'secret-'),'Safe projection');
  denied(fn()=>$connector->save(['credentials'=>[],'revision'=>$initial['revision']]),409);
  check($connector->verify()['ok'],'Connection verified');
  $context=new \dyws\PluginContext($id,$config,$id==='helcim'?['/payments/hc/events']:[]);\dyws\Payments\registerConnector($context,$connector);check(($context->routes['POST /manager/plugins/'.$id.'/verify']['handler'])()['ok'],'Verification route uses the real connector');check($connector->summary()['verifiedAt']!==null,'Verification recorded');check(count($calls)>0&&str_starts_with($calls[0]['url'],'https://'),'Real API contract');
  $connector->request('checkout.create',['payload'=>['amount'=>12.34,'txn_total'=>'12.34'],'idempotencyKey'=>'test-request']);$last=end($calls);check($last['method']==='POST','Checkout connector');
  $GLOBALS['dyws_config']=$config;$catalog=\dyws\Catalog::load(__DIR__.'/../examples/starlit-diner/catalog.json');$store=new \dyws\Store($config['database'],$catalog,$config['tenant']);
  $order=$store->create(['idempotencyKey'=>bin2hex(random_bytes(16)),'tip'=>500,'customer'=>['name'=>'Fictional Guest','phone'=>'7805550100'],'lines'=>[['id'=>'breakfast0','quantity'=>1]],'fulfillment'=>'pickup'],$id);
  $args=$connector->checkoutArguments($store,$order['id']);check($args===$connector->checkoutArguments($store,$order['id']),'Deterministic immutable order arguments');$payload=$args['payload'];
  $sent=match($id){
   'square'=>array_sum(array_map(fn($line)=>(int)$line['quantity']*$line['base_price_money']['amount'],$payload['order']['line_items'])),
   'paypal'=>(int)round((float)$payload['purchase_units'][0]['amount']['value']*100),
   'helcim'=>(int)round($payload['amount']*100),
   'clover'=>array_sum(array_map(fn($line)=>$line['unitQty']*$line['price'],$payload['shoppingCart']['lineItems'])),
   'moneris'=>(int)round((float)$payload['txn_total']*100),
   'authorize-net'=>(int)round((float)$payload['transactionRequest']['amount']*100)
  };
  check($sent===$order['total'],'Provider total includes the saved tip exactly once');
  if($id==='square')check($payload['checkout_options']['allow_tipping']===false&&end($payload['order']['line_items'])['name']==='Tip','Square sends a separate tip and disables a second prompt');
  if($id==='clover')check($payload['tips']['enabled']===false&&end($payload['shoppingCart']['lineItems'])['name']==='Tip','Clover sends a separate tip and disables a second prompt');
  if($id==='paypal'){$unit=$payload['purchase_units'][0];check(array_sum(array_map(fn($part)=>(int)round((float)$part['value']*100),$unit['amount']['breakdown']))===$sent,'PayPal amount breakdown reconciles');check(end($unit['items'])['name']==='Tip','PayPal tip item');}
  if($id==='authorize-net')check(end($payload['transactionRequest']['lineItems']['lineItem'])['itemId']==='tip','Authorize.net tip line');
  $connector->request('checkout.create',$args);check(count($store->query('SELECT * FROM payments'))===0,'Preparing and sending a connector request never confirms payment');
  $foreign=new \dyws\Store($config['database'],$catalog,'different-tenant');denied(fn()=>$connector->checkoutArguments($foreign,$order['id']),403);unset($foreign);
  $store->execute("UPDATE orders SET payment_provider='demo' WHERE id=?",[$order['id']]);denied(fn()=>$connector->checkoutArguments($store,$order['id']),409);unset($store);
  denied(fn()=>$connector->request('arbitrary.delete'),422);
  $state=$plugins->save(['id'=>$id,'active'=>true,'revision'=>$plugins->summary()['revision']]);check($plugins->paymentConnector($id) instanceof $class,'Active connector hook resolves');check($plugins->paymentProvider()==='demo','Connector activation never enables collection');
  check($plugins->match('POST','/manager/plugins/'.$id.'/settings')['access']==='manager','Settings authorized');
  $plugins->save(['id'=>$id,'active'=>false,'revision'=>$state['revision']]);$plugins=new Plugins($config);check($plugins->paymentConnector($id)===null,'Disabled connector removed');check($connector->summary()['configured'],'Deactivation retains settings');
  $files=glob($work.'/payment-'.$id.'-*.json');check(count($files)===1,'Tenant credential file');$raw=file_get_contents($files[0]);check(!str_contains($raw,'secret-')&&(fileperms($files[0])&0777)===0600,'Encrypted private settings');
  $other=new $class(array_replace($config,['tenant'=>'other']),$definition,$fake);check(!$other->summary()['configured'],'Tenant isolation');
  if($id==='moneris')continue;
  $raw=$id==='clover'?'{"merchantId":"merchant-test","id":"event-test"}':'{"id":"event-test"}';$t=(string)time();
  $headers=match($id){
   'square'=>['HTTP_X_SQUARE_HMACSHA256_SIGNATURE'=>base64_encode(hash_hmac('sha256',$connector->webhookUrl().$raw,$credentials['webhookSecret'],true))],
   'helcim'=>['HTTP_WEBHOOK_ID'=>'msg-test','HTTP_WEBHOOK_TIMESTAMP'=>$t,'HTTP_WEBHOOK_SIGNATURE'=>'v1,'.base64_encode(hash_hmac('sha256','msg-test.'.$t.'.'.$raw,'webhook-test-key',true))],
   'clover'=>['HTTP_CLOVER_SIGNATURE'=>'t='.$t.',v1='.hash_hmac('sha256',$t.'.'.$raw,$credentials['webhookSecret'])],
   'authorize-net'=>['HTTP_X_ANET_SIGNATURE'=>'sha512='.hash_hmac('sha512',$raw,hex2bin($credentials['signatureKey']))],default=>[]};
  if($id!=='paypal'){check($connector->verifyEvent($raw,$headers)['id']==='event-test','Valid signature');denied(fn()=>$connector->verifyEvent($raw.' ',$headers),400);}else denied(fn()=>$connector->verifyEvent($raw,[]),400);
 }
 echo "Payment connectors: $checks checks passed.\n";
}finally{foreach(glob($work.'/*') as $f)unlink($f);rmdir($work);}
