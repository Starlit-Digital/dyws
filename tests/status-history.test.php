<?php
declare(strict_types=1);
require __DIR__.'/../modules/dyws/php/module.php';
use dyws\{Catalog,Store,StatusHistory,ApiError};
$dir=sys_get_temp_dir().'/dyws-status-'.bin2hex(random_bytes(6));mkdir($dir,0700);$checks=0;
$GLOBALS['dyws_config']=['tracking_secret'=>str_repeat('s',64)];
function verify(bool $ok,string $message):void{global $checks;if(!$ok)throw new RuntimeException($message);$checks++;}
function denied(callable $fn,int $code=409):void{try{$fn();throw new RuntimeException('Expected rejection');}catch(ApiError $e){verify($e->http===$code,$e->getMessage());}}
try{
 $catalog=Catalog::load(__DIR__.'/../examples/starlit-diner/catalog.json');$store=new Store($dir.'/orders.sqlite',$catalog,'status-review');$history=new StatusHistory($store);
 $body=['idempotencyKey'=>bin2hex(random_bytes(16)),'customer'=>['name'=>'Fictional Status Guest','phone'=>'7805550142'],'fulfillment'=>'pickup','lines'=>[['id'=>'breakfast0','variant'=>'','quantity'=>1]],'demoAcknowledged'=>true];
 $order=$store->create($body);$id=$order['id'];$s=$history->summary($id);verify(!$s['canUndo']&&!$s['canRedo'],'Beginning has no undo or redo');
 $store->change($id,'accepted','manager');$s=$history->summary($id);verify($s['canUndo'],'Normal status changes enter undo history');
 $r=$history->apply($id,['action'=>'undo','revision'=>$s['revision']]);verify($r['order']['status']==='placed'&&$r['history']['canRedo'],'Undo restores previous stage');
 $r=$history->apply($id,['action'=>'redo','revision'=>$r['history']['revision']]);verify($r['order']['status']==='accepted','Redo restores next stage');
 $r=$history->apply($id,['action'=>'set','status'=>'preparing','revision'=>$r['history']['revision']]);$r=$history->apply($id,['action'=>'undo','revision'=>$r['history']['revision']]);
 $r=$history->apply($id,['action'=>'set','status'=>'ready','revision'=>$r['history']['revision']]);verify(!$r['history']['canRedo'],'Editing after undo creates a new branch');
 denied(fn()=>$history->apply($id,['action'=>'redo','revision'=>$r['history']['revision']]));
 denied(fn()=>$history->apply($id,['action'=>'set','status'=>'completed','revision'=>$r['history']['revision']]));
 denied(fn()=>$history->apply($id,['action'=>'set','status'=>'out_for_delivery','revision'=>$r['history']['revision']]),422);
 $stale=$r['history']['revision'];$store->payment($id,'capture');denied(fn()=>$history->apply($id,['action'=>'undo','revision'=>$stale]));
 $r=$history->apply($id,['action'=>'set','status'=>'completed','revision'=>$history->summary($id)['revision']]);$r=$history->apply($id,['action'=>'undo','revision'=>$r['history']['revision']]);
 verify($r['order']['status']==='ready'&&$r['order']['payment_status']==='paid','Undo completion preserves payment state');verify(count($store->query('SELECT * FROM payments WHERE tenant=? AND order_id=?',[$store->tenant,$id]))===1,'No duplicate capture or refund');
 verify(count($store->query('SELECT * FROM order_status_edits WHERE tenant=? AND order_id=?',[$store->tenant,$id]))===7,'Every correction has an audit entry');
 $store->change($id,'completed','manager');verify(!$history->summary($id)['canRedo'],'Normal transitions also clear the redo branch');
 $other=new Store($dir.'/orders.sqlite',$catalog,'other-review');denied(fn()=>(new StatusHistory($other))->summary($id),404);
 $delivery=$body;$delivery['idempotencyKey']=bin2hex(random_bytes(16));$delivery['fulfillment']='delivery';$delivery['address']='100 Fictional Street';$d=$store->create($delivery);$did=$d['id'];$s=$history->summary($did);
 denied(fn()=>$history->apply($did,['action'=>'set','status'=>'out_for_delivery','revision'=>$s['revision']]));
 $store->db->exec(file_get_contents(__DIR__.'/../modules/dyws/php/accounts.sql'));
 $store->execute('INSERT INTO drivers(tenant,id,name,password_hash,active) VALUES(?,?,?,?,1)',[$store->tenant,'fixture-driver','Fictional Driver',password_hash('fictional-driver-password',PASSWORD_DEFAULT)]);$store->assign($did,'fixture-driver');
 $r=$history->apply($did,['action'=>'set','status'=>'out_for_delivery','revision'=>$history->summary($did)['revision']]);verify($r['order']['status']==='out_for_delivery','An assigned driver permits the delivery stage');
 $store->execute('INSERT INTO location_shares(tenant,order_id,driver_id,sharing_hash,auth_hash,source,expires_at) VALUES(?,?,?,?,?,?,?)',[$store->tenant,$did,'fixture-driver','test','test','simulated',time()+60]);$s=$history->summary($did);denied(fn()=>$history->apply($did,['action'=>'undo','revision'=>$s['revision']]));
 $store->execute('DELETE FROM location_shares WHERE tenant=? AND order_id=?',[$store->tenant,$did]);$r=$history->apply($did,['action'=>'set','status'=>'ready','revision'=>$history->summary($did)['revision']]);
 $store->execute('INSERT INTO delivery_runs(tenant,id,driver_id,status,request_key,revision,created_at,updated_at) VALUES(?,?,?,?,?,1,?,?)',[$store->tenant,'RUN-FFFFFFFFFFFF','fixture-driver','planned','fixture-run',time(),time()]);$store->execute('INSERT INTO delivery_run_stops(tenant,run_id,order_id,position,active) VALUES(?,?,?,1,1)',[$store->tenant,'RUN-FFFFFFFFFFFF',$did]);$s=$history->summary($did);verify(!$s['editable'],'Dispatch run membership disables correction');denied(fn()=>$history->apply($did,['action'=>'undo','revision'=>$s['revision']]));
 $store->execute("UPDATE orders SET payment_provider='external' WHERE tenant=? AND id=?",[$store->tenant,$id]);$s=$history->summary($id);verify(!$s['editable'],'External payment orders are read only');denied(fn()=>$history->apply($id,['action'=>'undo','revision'=>$s['revision']]));
 $store->execute("UPDATE orders SET payment_provider='demo',customer_cancelled_at=? WHERE tenant=? AND id=?",[time(),$store->tenant,$id]);verify(!$history->summary($id)['editable'],'Customer cancellation is not reopened');
 echo "Status history: $checks assertions passed.\n";
}finally{unset($history,$other,$store);foreach(glob($dir.'/*') as $file)unlink($file);rmdir($dir);}
