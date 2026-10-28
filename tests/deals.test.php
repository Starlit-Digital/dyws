<?php
declare(strict_types=1);
require __DIR__.'/../modules/dyws/php/module.php';
use dyws\{Store,Catalog,Deals,ApiError};
$dir=sys_get_temp_dir().'/dyws-deals-'.bin2hex(random_bytes(6));mkdir($dir,0700);$checks=0;
function check($ok,$message){global $checks;if(!$ok)throw new RuntimeException($message);$checks++;}
function rejects(callable $fn,int $status=422){try{$fn();throw new RuntimeException('Expected rejection');}catch(ApiError $e){check($e->http===$status,$e->getMessage());}}
function deal(array $patch=[]):array{return array_replace(['id'=>'two-for-one','name'=>'Two for one','description'=>'Example offer','enabled'=>true,'type'=>'quantity','itemIds'=>['notebook'],'days'=>range(0,6),'startsOn'=>'2020-01-01','endsOn'=>'2099-12-31','claimDays'=>30,'buyQuantity'=>1,'getQuantity'=>1,'amountOff'=>0,'percentBasisPoints'=>0,'minSpend'=>0,'maxApplications'=>1],$patch);}
function body(array $patch=[]):array{return array_replace(['idempotencyKey'=>bin2hex(random_bytes(16)),'customer'=>['name'=>'Example Customer','phone'=>'7805550142'],'fulfillment'=>'pickup','lines'=>[['id'=>'notebook','quantity'=>2]]],$patch);}
try{
 $GLOBALS['dyws_config']=['tracking_secret'=>str_repeat('b',64)];$catalog=Catalog::load(__DIR__.'/../examples/general-store/catalog.json');$catalog['deals']=[deal()];$catalog=Catalog::validate($catalog);
 foreach([['type'=>'fake'],['endsOn'=>'bad'],['startsOn'=>'2027-01-01','endsOn'=>'2026-01-01'],['days'=>[]],['days'=>[7]],['itemIds'=>['missing']],['getQuantity'=>0],['type'=>'spend_percent','percentBasisPoints'=>0],['claimDays'=>'30']] as $bad){$data=$catalog;$data['deals']=[deal($bad)];rejects(fn()=>Catalog::validate($data));}
 $now=(new DateTimeImmutable('2026-10-28 12:00:00',new DateTimeZone('America/Edmonton')))->getTimestamp();
 check(Deals::active(deal(), 'America/Edmonton',$now),'Daily offer active');check(!Deals::active(deal(['days'=>[0]]),'America/Edmonton',$now),'Weekday schedule enforced');
 check(Deals::active(deal(['days'=>[1]]),'America/Edmonton',(new DateTimeImmutable('2026-10-28 05:00:00 UTC'))->getTimestamp()),'Restaurant timezone decides the day');
 check(!Deals::active(deal(['endsOn'=>'2026-10-27']),'America/Edmonton',$now),'End date expires');check(!Deals::active(deal(['startsOn'=>'2026-10-29']),'America/Edmonton',$now),'Start date enforced');
 $lines=[['id'=>'notebook','quantity'=>1,'price'=>2000],['id'=>'notebook','quantity'=>1,'price'=>1001],['id'=>'other','quantity'=>1,'price'=>10000]];
 $result=Deals::calculate(deal(),$lines);check($result['discount']===1001&&$result['lines'][1]['discount']===1001,'Cheapest eligible unit free, other items excluded');
 rejects(fn()=>Deals::calculate(deal(),array_slice($lines,0,1)));
 $three=Deals::calculate(deal(['getQuantity'=>2]),[['id'=>'notebook','quantity'=>3,'price'=>1295]]);check($three['discount']===2590,'Three for one gives two units free');
 $repeat=Deals::calculate(deal(['maxApplications'=>2]),[['id'=>'notebook','quantity'=>5,'price'=>1295]]);check($repeat['discount']===2590,'Group cap and odd quantities');
 $amount=Deals::calculate(deal(['type'=>'buy_amount_off','amountOff'=>500]),$lines);check($amount['discount']===500,'Buy one get fixed amount off next');
 $amount=Deals::calculate(deal(['type'=>'buy_amount_off','amountOff'=>5000]),$lines);check($amount['discount']===1001,'Discount cannot exceed discounted unit');
 $percent=deal(['type'=>'spend_percent','percentBasisPoints'=>1500,'minSpend'=>3000]);$result=Deals::calculate($percent,$lines);check($result['discount']===450&&array_sum(array_column($result['lines'],'discount'))===450,'Percentage round and allocation reconcile');
 rejects(fn()=>Deals::calculate(array_replace($percent,['minSpend'=>3002]),$lines));
 $all=Deals::calculate(deal(['type'=>'spend_amount_off','itemIds'=>[],'amountOff'=>2000]),$lines);check($all['discount']===2000,'Fixed whole order discount');
 $store=new Store($dir.'/orders.sqlite',$catalog,'one');$wallet=$store->deals()->claim('owner-a','two-for-one');$claim=$wallet['activeClaimId'];check(count($wallet['claims'])===1&&$claim!==null,'Claim saved and selected');check($store->deals()->claim('owner-a','two-for-one')['activeClaimId']===$claim,'Claim retry does not duplicate');
 rejects(fn()=>$store->quoteCheckout(body(['dealClaimId'=>$claim]),null),401);rejects(fn()=>$store->quoteCheckout(body(['dealClaimId'=>$claim]),'owner-b'),409);
 $other=new Store($dir.'/orders.sqlite',$catalog,'two');rejects(fn()=>$other->quoteCheckout(body(['dealClaimId'=>$claim]),'owner-a'),409);
 $quote=$store->quoteCheckout(body(['dealClaimId'=>$claim]),'owner-a');check($quote['grossSubtotal']===2590&&$quote['discount']===1295&&$quote['subtotal']===1295&&$quote['tax']===65&&$quote['total']===1360,'Discount before tax and total authoritative');
 $order=body(['dealClaimId'=>$claim,'discount'=>999999,'total'=>1]);$receipt=$store->create($order,'demo',null,'owner-a');check($receipt['total']===1360,'Client price and savings ignored');
 $saved=$store->get($receipt['id']);check($saved['discount']===1295&&json_decode($saved['deal_json'],true)['name']==='Two for one','Immutable deal snapshot');
 check($store->create($order,'demo',null,'owner-a')['id']===$receipt['id'],'Used claim order retry remains idempotent');rejects(fn()=>$store->create(body(['dealClaimId'=>$claim]),'demo',null,'owner-a'),409);rejects(fn()=>$store->deals()->claim('owner-a','two-for-one'),409);
 check($store->deals()->listing('owner-a')['claims'][0]['state']==='used','Wallet marks redemption used');
 $wallet=$store->deals()->claim('owner-c','two-for-one');$claim=$wallet['activeClaimId'];$store->execute('UPDATE deal_claims SET expires_at=? WHERE tenant=? AND id=?',[time()-1,'one',$claim]);rejects(fn()=>$store->quoteCheckout(body(['dealClaimId'=>$claim]),'owner-c'),409);
 $wallet=$store->deals()->claim('owner-d','two-for-one');$claim=$wallet['activeClaimId'];rejects(fn()=>$store->create(body(['dealClaimId'=>$claim,'locationId'=>'missing']),'demo',null,'owner-d'));check($store->deals()->listing('owner-d')['claims'][0]['state']==='ready','Failed checkout does not consume claim');
 $gone=$catalog;$gone['deals']=[];$removed=new Store($dir.'/orders.sqlite',$gone,'one');rejects(fn()=>$removed->quoteCheckout(body(['dealClaimId'=>$claim]),'owner-d'),409);
 $html=dyws_render_menu(Catalog::publicData($catalog));check(strpos($html,'id="dyws-deals"')<strpos($html,'class="dyws-category"'),'Deals above the menu');check(str_contains($html,'dyws-item-deal-badge')&&str_contains($html,'2 for 1'),'Item carries quantity badge');
 $free=$catalog;$free['deals']=[deal(['id'=>'free','type'=>'spend_percent','percentBasisPoints'=>10000,'itemIds'=>[]])];$freeStore=new Store($dir.'/orders.sqlite',$free,'free');$freeClaim=$freeStore->deals()->claim('free-owner','free')['activeClaimId'];$freeReceipt=$freeStore->create(body(['dealClaimId'=>$freeClaim]),'demo',null,'free-owner');check($freeReceipt['total']===0&&$freeStore->get($freeReceipt['id'])['payment_status']==='paid','No charge required when a full discount makes the total zero');
 $empty=$catalog;$empty['deals']=null;rejects(fn()=>Catalog::validate($empty));
 unset($freeStore);
 $hidden=$catalog;$hidden['categories'][0]['items'][0]['active']=false;$published=Catalog::publicData($hidden);check($published['deals']===[],'Offers for unavailable items are not advertised');check(!str_contains(dyws_render_menu($published),'2 for 1'),'Hidden deal targets do not break server rendering');
 $unsupported=$catalog;$unsupported['customerCancellation']=['enabled'=>true,'minutes'=>4];$unsupportedStore=new Store($dir.'/orders.sqlite',$unsupported,'one');rejects(fn()=>$unsupportedStore->create(body(['dealClaimId'=>$claim]),'external',null,'owner-d'),503);check($store->deals()->listing('owner-d')['claims'][0]['state']==='ready','A later provider policy failure rolls back claim redemption and order creation');unset($unsupportedStore);
 echo "Deals: $checks checks passed.\n";
}finally{unset($store,$other,$removed);foreach(glob($dir.'/*') as $p)unlink($p);rmdir($dir);}
