<?php
declare(strict_types=1);
require __DIR__.'/../modules/dyws/php/module.php';
require __DIR__.'/../plugins/nominatim/AddressLookup.php';
use dyws\{Plugins,ApiError};
use dyws\Plugins\Nominatim\AddressLookup;
$work=sys_get_temp_dir().'/dyws-nominatim-'.bin2hex(random_bytes(5));mkdir($work,0700);$checks=0;
function check($ok,$message){global $checks;if(!$ok)throw new RuntimeException($message);$checks++;}
function denied($fn,$status=422){try{$fn();throw new RuntimeException('Expected rejection');}catch(ApiError $e){check($e->http===$status,'Unexpected status: '.$e->getMessage());}}
try{
 $config=['database'=>$work.'/orders.sqlite','tenant'=>'alpha','tracking_secret'=>bin2hex(random_bytes(32))];$calls=[];
 $client=['endpoint'=>'https://geo.sltd.ca/search','username'=>'test','password'=>'private_test_credential'];
 $lookup=new AddressLookup($config,function($s,$q)use(&$calls){$calls[]=$q;return [['display_name'=>'Example City Hall','address'=>['house_number'=>'123','road'=>'Example Street','city'=>'Edmonton','ISO3166-2-lvl4'=>'CA-AB','postcode'=>'T5A 1A1','country'=>'Canada','country_code'=>'ca']],['display_name'=>'Elsewhere','address'=>['country_code'=>'us']]];});
 check(!$lookup->publicConfig()['enabled'],'Unconfigured disabled');denied(fn()=>$lookup->search(['query'=>'Edmonton']),503);
 denied(fn()=>$lookup->provision(array_replace($client,['endpoint'=>'https://nominatim.openstreetmap.org/search'])));
 denied(fn()=>$lookup->provision(array_replace($client,['endpoint'=>'http://geo.sltd.ca/search'])));
 $saved=$lookup->provision($client);check($saved['configured']&&$saved['enabled'],'Provisioned');
 check(!str_contains(json_encode($saved),'private_test_credential')&&!str_contains(json_encode($lookup->publicConfig()),'username'),'Summaries redact secrets');
 $file=glob($work.'/nominatim-*.json')[0];check(!str_contains(file_get_contents($file),'private_test_credential'),'Encrypted at rest');check((fileperms($file)&0777)===0600,'Private file');
 foreach(['abc',str_repeat('a',241),"bad\naddress",['not text']] as $q)denied(fn()=>$lookup->search(['query'=>$q]));
 $result=$lookup->search(['query'=>'Edmonton','customer'=>'must not forward']);check($calls===['Edmonton'],'Only address query forwarded');check(count($result['results'])===1&&$result['results'][0]['region']==='AB'&&$result['results'][0]['line1']==='123 Example Street','Normalized Canadian results');
 $partial=new AddressLookup($config,fn()=>[['display_name'=>'Partial postal','address'=>['country_code'=>'ca','postcode'=>'T5A']]]);check($partial->search(['query'=>'Edmonton'])['results'][0]['postalCode']==='','Incomplete OSM postal codes cannot invalidate checkout');
 $street=new AddressLookup($config,fn()=>[['display_name'=>'Example Street','address'=>['country_code'=>'ca','road'=>'Example Street','postcode'=>'T5A 1A1']]]);check($street->search(['query'=>'Example Street'])['results'][0]['postalCode']==='','Street results cannot fill a house postal code');
 $disabled=$lookup->save(['enabled'=>false,'revision'=>$saved['revision']]);check($disabled['configured']&&!$disabled['enabled'],'Disable preserves credentials');denied(fn()=>$lookup->save(['enabled'=>true,'revision'=>$saved['revision']]),409);denied(fn()=>$lookup->search(['query'=>'Edmonton']),503);
 check(!(new AddressLookup(array_replace($config,['tenant'=>'beta'])))->summary()['configured'],'Tenant isolation');
 $lookup->save(['enabled'=>true,'revision'=>$disabled['revision']]);
 $failure=new AddressLookup($config,fn()=>throw new RuntimeException('secret'));denied(fn()=>$failure->search(['query'=>'Edmonton']),503);
 $demo=new AddressLookup(array_replace($config,['demo_lockdown'=>true]),fn()=>throw new RuntimeException('Demo must not access network'));
 check($demo->search(['query'=>'Any arbitrary address'])['results'][0]['line1']==='123 Example Avenue NW','Demo never calls service');denied(fn()=>$demo->save(['enabled'=>false,'revision'=>'demo']),403);
 $plugins=new Plugins($config);$state=$plugins->summary();$state=$plugins->save(['id'=>'nominatim','active'=>true,'revision'=>$state['revision']]);check($plugins->match('POST','/plugins/nominatim/search')['rateLimit']===['nominatim-search',40,60],'Search rate limited');check($plugins->match('GET','/manager/plugins/nominatim/settings')['access']==='manager','Manager authentication');
 $plugins->save(['id'=>'nominatim','active'=>false,'revision'=>$state['revision']]);check($plugins->match('POST','/plugins/nominatim/search')===null,'Deactivation removes route');check($lookup->summary()['configured'],'Deactivation keeps credentials');
 echo "Nominatim: $checks checks passed.\n";
}finally{foreach(glob($work.'/*')as $file)unlink($file);rmdir($work);}
