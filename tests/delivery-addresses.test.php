<?php
declare(strict_types=1);
require __DIR__.'/../modules/dyws/php/module.php';
use dyws\{Store,DeliveryAddresses,CustomerAccounts,CustomerDrivers,GuestDetails,ApiError};
$path=tempnam(sys_get_temp_dir(),'dyws-address-test-');$checks=0;
$catalog=json_decode(file_get_contents(__DIR__.'/../examples/starlit-diner/catalog.json'),true);
$GLOBALS['dyws_config']=['tracking_secret'=>str_repeat('a',64)];
function check($ok,string $message):void {global $checks;if(!$ok)throw new RuntimeException($message);$checks++;}
function body(array $details=[],array $changes=[]):array {
 return array_replace(['idempotencyKey'=>bin2hex(random_bytes(16)),'customer'=>['name'=>'Fictional Customer','phone'=>'7805550142'],'lines'=>[['id'=>'breakfast0','variant'=>'','quantity'=>1]],'fulfillment'=>'delivery','addressDetails'=>array_replace(['line1'=>'123 Fictional Road','line2'=>'Unit 4','city'=>'Edmonton','region'=>'AB','postalCode'=>'T5A 1A1','country'=>'Canada'],$details)],$changes);
}
function place(Store $s,array $body,?string $customer='CUS-ONE'):array {return $s->get($s->create($body,'demo',$customer)['id']);}
try{
 // Start at the deployed schema before permanent address IDs. Existing accounts are preserved.
 $db=new PDO('sqlite:'.$path);$db->exec(file_get_contents(__DIR__.'/../modules/dyws/php/schema.sql'));
 $db->exec("ALTER TABLE orders ADD COLUMN customer_id TEXT; ALTER TABLE orders ADD COLUMN address_json TEXT NOT NULL DEFAULT '{}'");
 $db->exec(file_get_contents(__DIR__.'/../modules/dyws/php/customers.sql'));
 $db->exec("INSERT INTO customers VALUES('alpha','CUS-ONE','one@example.test',100,100),('alpha','CUS-TWO','two@example.test',100,100)");
 $details=body()['addressDetails'];$text=implode(', ',$details);
 $db->prepare('INSERT INTO orders(id,tenant,request_key,fingerprint,tracking_hash,tracking_expires,status,payment_status,fulfillment,customer_name,customer_phone,address,address_json,customer_id,notes,lines_json,subtotal,tax,total,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')->execute(['DYWS-111111111111','alpha','legacy-key','legacy-fingerprint','legacy-token',2147483647,'delivered','paid','delivery','Fictional Customer','7805550142',$text,json_encode($details),'CUS-ONE','Keep original receipt','[]',100,5,105,1000,1000]);
 $guestToken=str_repeat('b',64);
 $db->prepare('INSERT INTO guest_details VALUES(?,?,?,?,?,?,?)')->execute(['alpha','guest-profile',hash('sha256',$guestToken),'Fictional Guest','7805550142','editable-bookmark',time()+86400]);
 $db->prepare('INSERT INTO guest_addresses VALUES(?,?,?,?,?,?)')->execute(['alpha','guest-profile','editable-bookmark','Home',json_encode($details),1000]);unset($db);
 $s=new Store($path,$catalog,'alpha');$addresses=new DeliveryAddresses($s);
 $legacy=$s->get('DYWS-111111111111');$addressId=$legacy['delivery_address_id'];
 check((bool)preg_match('/^ADR-[A-F0-9]{24}$/D',$addressId),'Migration assigns a permanent address ID');
 check($legacy['address']===$text&&$legacy['fingerprint']==='legacy-fingerprint'&&$legacy['tracking_hash']==='legacy-token'&&$legacy['total']===105,'Migration preserves receipts, payment and capabilities');
 check($s->query('SELECT delivery_address_id FROM guest_addresses')[0]['delivery_address_id']===$addressId,'Existing guest bookmark refers to the same destination');
 check($addresses->listing('CUS-ONE')['addresses'][0]['id']===$addressId,'Migration creates the account and address pair');
 check($addresses->listing('CUS-TWO')['addresses']===[],'Shared database grants no other account access');
 $reopened=new Store($path,$catalog,'alpha');check($reopened->get($legacy['id'])['delivery_address_id']===$addressId,'Repeated migration keeps identity');unset($reopened);
 $request=body();$order=place($s,$request);
 check($order['delivery_address_id']===$addressId,'New orders reuse migrated destinations');
 check(place($s,$request)['id']===$order['id']&&count($addresses->listing('CUS-ONE')['addresses'])===1,'Retries do not duplicate destinations or pairs');
 $variant=place($s,body(['line1'=>' 123   fictional ROAD ','line2'=>'apt. 4','city'=>'EDMONTON','region'=>'Alberta','postalCode'=>'t5a1a1','country'=>'CA']));
 check($variant['delivery_address_id']===$addressId,'Case, whitespace, postal formatting, province and unit labels normalize');
 check(place($s,body(['place_id'=>456,'osm_id'=>789],['addressId'=>'changed-provider-id']))['delivery_address_id']===$addressId,'Map provider identifier changes do not change the destination');
 check($s->get($order['id'])['address']===$text,'Later variants never rewrite an original receipt');
 foreach([['line2'=>'Unit 5'],['line2'=>''],['city'=>'Calgary'],['line1'=>'124 Fictional Road'],['country'=>'US'],['city'=>'']] as $change){
  check(place($s,body($change))['delivery_address_id']!==$addressId,'Different or incomplete destinations remain distinct: '.json_encode($change));
 }
 $other=place($s,body(),'CUS-TWO');
 check($other['delivery_address_id']===$addressId,'Customers can share a destination without sharing identity');
 check(count($addresses->listing('CUS-TWO')['addresses'])===1,'The second account receives only its own pair');
 $s->execute('INSERT INTO customer_driver_blocks VALUES(?,?,?,?,?)',['alpha','CUS-ONE','example-driver',$legacy['id'],time()]);
 $moved=place($s,body(['line1'=>'999 Other Fictional Road']));
 check(CustomerDrivers::blocked($s,$moved,'example-driver')&&!CustomerDrivers::blocked($s,$other,'example-driver'),'Blocks follow the account across destinations without affecting a neighbour');
 $guest=place($s,body(),null);
 check($guest['delivery_address_id']===$addressId&&$guest['customer_id']===null&&!CustomerDrivers::blocked($s,$guest,'example-driver'),'A guest destination never implies account ownership or inherits a neighbour block');
 $forged=place($s,body(['line1'=>'555 New Fictional Road','id'=>$addressId],['deliveryAddressId'=>$addressId,'customerId'=>'CUS-ONE','customer'=>['name'=>'Fictional Guest','phone'=>'7805550142','email'=>'one@example.test']]),null);
 check($forged['customer_id']===null&&$forged['delivery_address_id']!==$addressId,'Submitted IDs and email cannot choose the account or destination identity');
 $pickup=place($s,body([],['fulfillment'=>'pickup']));check($pickup['delivery_address_id']===null,'Pickup has no delivery identity');
 $freeform=body([],['address'=>'123 Fictional Road, Edmonton']);unset($freeform['addressDetails']);
 $oldFormat=place($s,$freeform);$freeform['idempotencyKey']=bin2hex(random_bytes(16));$freeform['address']=' 123   FICTIONAL ROAD, Edmonton ';
 check(place($s,$freeform)['delivery_address_id']===$oldFormat['delivery_address_id'],'Legacy freeform clients have stable identities');
 check($oldFormat['delivery_address_id']!==$addressId,'Freeform addresses never guess missing unit or structured parts');
 $newGuestBody=body(['line1'=>'777 Claim Fictional Road']);$receipt=$s->create($newGuestBody);
 check(count($addresses->listing('CUS-TWO')['addresses'])===1,'Guest orders do not create account pairs');
 $accounts=new CustomerAccounts($s,['public_base_url'=>'http://localhost']);
 $claimed=$accounts->claim('CUS-TWO',$receipt['id'],$receipt['trackingToken']);
 check($claimed['deliveryAddressId']===$s->get($receipt['id'])['delivery_address_id']&&count($addresses->listing('CUS-TWO')['addresses'])===2,'Claim links the existing destination only after capability checks');
 $accounts->claim('CUS-TWO',$receipt['id'],$receipt['trackingToken']);check(count($addresses->listing('CUS-TWO')['addresses'])===2,'Claim retry is safe');
 // Editing and forgetting a device bookmark never reassigns a permanent destination.
 $_COOKIE['dyws_guest_'.substr(hash('sha256','alpha|/'),0,16)]=$guestToken;
 $guestDetails=new GuestDetails($s,['public_base_url'=>'http://localhost']);
 $s->transaction(fn()=>$guestDetails->ordered($moved,['enabled'=>true,'profileId'=>'guest-profile','addressId'=>'editable-bookmark','label'=>'Home','default'=>true]));
 check($s->query('SELECT id,delivery_address_id FROM guest_addresses')[0]===['id'=>'editable-bookmark','delivery_address_id'=>$moved['delivery_address_id']],'Editable bookmark now points to the new permanent destination');
 $guestDetails->manage(['action'=>'forget']);
 check($s->get($legacy['id'])['delivery_address_id']===$addressId&&$addresses->listing('CUS-ONE')['addresses']!==[],'Forgetting device details preserves account history and destination IDs');
 // Identity and association are committed with the order, not before it.
 $before=$s->query('SELECT count(*) AS n FROM delivery_addresses')[0]['n'];
 try{$s->transaction(function()use($s){place($s,body(['line1'=>'999 Rollback Fictional Road']));throw new RuntimeException('rollback fixture');});}catch(RuntimeException $e){if($e->getMessage()!=='rollback fixture')throw $e;}
 check($s->query('SELECT count(*) AS n FROM delivery_addresses')[0]['n']===$before,'Order rollback also rolls back destination and pair');
 check(!array_key_exists('delivery_address_id',$s->safeOrder($order))&&!array_key_exists('deliveryAddressId',$s->tracking($receipt['id'],$receipt['trackingToken'])),'Generic driver, plugin and tracking projections omit permanent identity');
 // Separate tenants cannot share addresses or read pairs, even with the same customer ID.
 $beta=new Store($path,$catalog,'beta');$beta->execute('INSERT INTO customers VALUES(?,?,?,?,?)',['beta','CUS-ONE','one@example.test',100,100]);
 check((new DeliveryAddresses($beta))->listing('CUS-ONE')['addresses']===[],'Address listing is tenant scoped');
 check(place($beta,body())['delivery_address_id']!==$addressId,'Identical text in another tenant receives a separate identity');
 for($n=0;$n<24;$n++)place($s,body(['line1'=>"$n Pagination Fictional Road"]),'CUS-TWO');
 $page=$addresses->listing('CUS-TWO');$next=$addresses->listing('CUS-TWO',$page['nextOffset']);
 check(count($page['addresses'])===20&&$page['nextOffset']===20&&count($next['addresses'])===6&&$next['nextOffset']===null,'Address history is bounded and paginated');
 check(count(array_unique(array_column(array_merge($page['addresses'],$next['addresses']),'id')))===26,'Pagination never repeats an address');
 check($s->query('PRAGMA foreign_key_check')===[],'All account and address relationships satisfy foreign keys');
 echo "Delivery addresses: $checks checks passed.\n";
}finally{unset($s,$beta,$addresses,$accounts,$guestDetails);foreach([$path,$path.'-wal',$path.'-shm'] as $file)if(is_file($file))unlink($file);}
