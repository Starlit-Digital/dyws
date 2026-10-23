import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn,execFileSync} from 'node:child_process';
import net from 'node:net';
import {WebSocket} from 'ws';
import {createRealtimeServer} from '../server.js';
import {createRealtimeAPI} from '../../../../public_html/dyws/realtime.js';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const until=async fn=>{for(let n=0;n<100;n++){if(await fn())return;await delay(25);}throw new Error('Condition did not become true');};
test('WebSocket RPC, scoped live updates, HTTP polling fallback and safe mutations',async()=>{
 const root=fileURLToPath(new URL('../../../../',import.meta.url));
 const work=await mkdtemp(join(tmpdir(),'dyws-ws-'));let php,service,api,customer,other,stop,stopCustomer,stopOther;
 try{
  execFileSync('php',[join(root,'server/setup.php'),work]);
  const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
  const endpoint=`http://127.0.0.1:${port}/api/index.php`,secret='test-secret-'.repeat(4),origin='http://127.0.0.1';
  service=createRealtimeServer({backend:endpoint,secret,origins:[origin],port:0});await service.listen();const socketURL=`ws://127.0.0.1:${service.server.address().port}/dyws`;
  const config=JSON.parse(await readFile(join(work,'config.json')));config.realtime={url:socketURL,secret,publishUrl:`http://127.0.0.1:${service.server.address().port}/publish`};await writeFile(join(work,'config.json'),JSON.stringify(config));
  php=spawn('php',['-S',`127.0.0.1:${port}`,'-t',join(root,'public_html')],{env:{...process.env,DYWS_CONFIG:join(work,'config.json')},stdio:'ignore'});
  await until(async()=>{try{return (await fetch(endpoint+'?route=/health')).ok;}catch{return false;}});
  class BrowserSocket extends WebSocket{constructor(url){super(url,{origin});}}
  api=createRealtimeAPI(endpoint,{WebSocket:BrowserSocket,connectTimeout:200,requestTimeout:1000});await until(()=>api.transport==='websocket');
  const access=await readFile(join(work,'LOCAL-ACCESS.txt'),'utf8');
  const manager=await api('/login',{method:'POST',body:{role:'manager',password:access.match(/Manager password: (.+)/)[1]}});
  const driver=await api('/login',{method:'POST',body:{role:'driver',driverId:'demo-driver',password:access.match(/Driver password: (.+)/)[1]}});
  await assert.rejects(api('/manager/orders',{token:driver.token}),e=>e.status===403);
  let operatorEvents=0,trackingEvents=0,publicEvents=0;
  stop=api.watch({scope:'operator',token:manager.token,interval:100},()=>operatorEvents++);
  const body={idempotencyKey:crypto.randomUUID(),customer:{name:'Fictional GPS guest',phone:'7805550142'},fulfillment:'delivery',address:'Fictional Manning address',lines:[{id:'breakfast0',variant:'',quantity:1}],demoAcknowledged:true};
  const receipt=await api('/orders',{method:'POST',body});await until(()=>operatorEvents>0);
  customer=createRealtimeAPI(endpoint,{WebSocket:BrowserSocket});other=createRealtimeAPI(endpoint,{WebSocket:BrowserSocket});
  stopCustomer=customer.watch({scope:'tracking',orderId:receipt.id,trackingToken:receipt.trackingToken,interval:100},event=>{if(event.type==='change')trackingEvents++;});
  stopOther=other.watch({scope:'public',interval:100},event=>{if(event.type==='change')publicEvents++;});
  await until(()=>[...service.wss.clients].filter(ws=>ws.subs.size).length===3);
  await assert.rejects(api('/realtime/access',{method:'POST',body:{scope:'tracking',orderId:receipt.id},trackingToken:'a'.repeat(64)}),e=>e.status===404);
  for(const status of ['accepted','preparing','ready'])await api('/manager/orders/'+receipt.id+'/status',{method:'POST',token:manager.token,body:{status}});
  await api('/manager/orders/'+receipt.id+'/assign',{method:'POST',token:manager.token,body:{driverId:'demo-driver'}});
  await api('/driver/orders/'+receipt.id+'/status',{method:'POST',token:driver.token,body:{status:'out_for_delivery'}});
  const share=await api('/driver/orders/'+receipt.id+'/location/start',{method:'POST',token:driver.token,body:{source:'simulated'}});
  const before=trackingEvents;
  await api('/driver/orders/'+receipt.id+'/location',{method:'POST',token:driver.token,body:{latitude:53.61665,longitude:-113.39804,accuracy:8,recordedAt:Math.floor(Date.now()/1000),sharingToken:share.sharingToken}});
  await until(()=>trackingEvents>before);assert.equal(publicEvents,0,'Public clients never receive private order invalidations');
  const tracked=await customer('/tracking/'+receipt.id,{trackingToken:receipt.trackingToken});assert.equal(tracked.locationSource,'simulated');
  const orders=await api('/manager/orders',{token:manager.token});assert.deepEqual(orders.orders[0].gps.location,tracked.location);
  // HTTP mutations notify WebSocket clients too.
  const prior=trackingEvents;
  await fetch(endpoint+'?route='+encodeURIComponent('/driver/orders/'+receipt.id+'/location/stop'),{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+driver.token},body:JSON.stringify({sharingToken:share.sharingToken})});
  await until(()=>trackingEvents>prior);
  assert.equal((await customer('/tracking/'+receipt.id,{trackingToken:receipt.trackingToken})).location,null);
  // Reject untrusted browser origins before the upgrade.
  await new Promise(resolve=>{const bad=new WebSocket(socketURL,{origin:'https://untrusted.invalid'});bad.on('error',()=>resolve());bad.on('open',()=>{bad.close();assert.fail('Unexpected upgrade');});});
  await service.close();service=null;await until(()=>api.transport==='polling');
  const count=operatorEvents;await until(()=>operatorEvents>count);assert.equal((await api('/manager/orders',{token:manager.token})).orders.length,1);
  assert.equal((await api('/orders',{method:'POST',body})).id,receipt.id,'HTTP fallback preserves order idempotency');
 }finally{stop?.();stopCustomer?.();stopOther?.();api?.close();customer?.close();other?.close();if(service)await service.close();if(php){php.kill();await new Promise(r=>php.once('exit',r));}await rm(work,{recursive:true,force:true});}
});
