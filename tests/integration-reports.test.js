import test from 'node:test';
import assert from 'node:assert/strict';
import {createIntegrationReportClient} from '../public_html/dyws/integration-reports.js';
const definition={id:'reports.summary',readOnly:true,transport:{version:1,preferredMethod:'QUERY',fallbackMethod:'POST',supportedMethods:['QUERY','POST']}};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const endpoint='https://example.test/store/api/';
function fixture(handler,options={}){
 const calls=[],metrics=[];
 const client=createIntegrationReportClient(endpoint,{token:'fictional-key',onMetric:event=>metrics.push(event),fetch:async(url,init)=>{calls.push({url, ...init});return handler(init,calls.length);},...options});
 return {client,calls,metrics};
}
test('Discovery enables primary QUERY, caches capability, and preserves subdirectory and input',async()=>{
 const {client,calls,metrics}=fixture(({method})=>reply(method==='GET'?definition:{total:42}));
 assert.deepEqual(await client.summary({from:'2026-10-01'}),{total:42});await client.summary({to:'2026-10-29'});
 assert.deepEqual(calls.map(c=>c.method),['GET','QUERY','QUERY']);
 assert.equal(calls[1].url.pathname,'/store/api/');
 assert.equal(calls[1].url.searchParams.get('route'),'/integrations/v1/commands/reports.summary/execute');
 assert.equal(calls[1].body,'{"from":"2026-10-01"}');
 assert.equal(calls[1].headers.Authorization,'Bearer fictional-key');
 assert.equal(calls[1].redirect,'error');assert.equal(calls[1].cache,'no-store');
 assert.ok(metrics.some(m=>m.event==='result'&&m.ok&&!m.fallback));
 assert.ok(!JSON.stringify(metrics).includes('fictional-key'));assert.ok(!JSON.stringify(metrics).includes('2026-10-01'));
});
for(const status of [405,501])test(`HTML ${status} falls back once with identical credentials and body, then remembers POST`,async()=>{
 let clock=0;
 const {client,calls,metrics}=fixture(({method})=>method==='GET'?reply(definition):method==='QUERY'?new Response('<html>unsupported</html>',{status}):reply({ok:true}),{now:()=>clock});
 await client.summary({from:'2026-10-01'});await client.summary();
 assert.deepEqual(calls.map(c=>c.method),['GET','QUERY','POST','POST']);
 assert.equal(calls[1].body,calls[2].body);assert.deepEqual(calls[1].headers,calls[2].headers);
 assert.ok(metrics.some(m=>m.event==='result'&&m.fallback&&m.attempts===2));
 clock=300001;await client.summary();assert.deepEqual(calls.slice(-3).map(c=>c.method),['GET','QUERY','POST']);
});
for(const status of [400,401,403,404,413,415,422,429,500,503])test(`HTTP ${status} never downgrades QUERY`,async()=>{
 const {client,calls}=fixture(({method})=>reply(method==='GET'?definition:{error:'Denied'},method==='GET'?200:status));
 await assert.rejects(client.summary(),e=>e.status===status);assert.deepEqual(calls.map(c=>c.method),['GET','QUERY']);
});
test('Old discovery and server disabled capability use POST',async()=>{
 for(const value of [{id:'reports.summary',method:'POST'}, {...definition,transport:{...definition.transport,preferredMethod:'POST',supportedMethods:['POST']}}]){
  const {client,calls}=fixture(({method})=>reply(method==='GET'?value:{}));await client.summary();assert.deepEqual(calls.map(c=>c.method),['GET','POST']);
 }
});
test('Operator switch bypasses discovery and immediately forces POST',async()=>{
 const {client,calls}=fixture(({method})=>reply(method==='GET'?definition:{}));await client.summary();client.setForcePost(true);await client.summary();assert.equal(calls.at(-1).method,'POST');assert.equal(calls.length,3);
 const forced=fixture(()=>reply({}),{forcePost:true});await forced.client.summary();assert.deepEqual(forced.calls.map(c=>c.method),['POST']);
});
test('Failure of fallback is not retried',async()=>{
 const {client,calls}=fixture(({method})=>method==='GET'?reply(definition):reply({error:'Unavailable'},501));await assert.rejects(client.summary(),e=>e.status===501);assert.equal(calls.length,3);
});
test('Discovery auth failure never executes and network failure never retries a report',async()=>{
 const denied=fixture(()=>reply({error:'Denied'},401));await assert.rejects(denied.client.summary(),e=>e.status===401);assert.equal(denied.calls.length,1);
 const failed=fixture(({method})=>{if(method==='GET')return reply(definition);throw new TypeError('Offline');});await assert.rejects(failed.client.summary(),/Offline/);assert.equal(failed.calls.length,2);
});
const pending=signal=>new Promise((resolve,reject)=>{if(signal.aborted)reject(signal.reason);else signal.addEventListener('abort',()=>reject(signal.reason),{once:true});});
for(const phase of ['discovery','headers','body'])test(`Total timeout covers ${phase} without a retry`,async()=>{
 const {client,calls}=fixture(({method,signal})=>{
  if(method==='GET')return phase==='discovery'?pending(signal):reply(definition);
  return phase==='body'?{ok:true,status:200,json:()=>pending(signal)}:pending(signal);
 },{timeoutMs:15});
 await assert.rejects(client.summary(),{name:'TimeoutError'});assert.equal(calls.length,phase==='discovery'?1:2);
});
test('Cancellation prevents fallback and observer failures do not fail a successful report',async()=>{
 const controller=new AbortController();
 const {client,calls}=fixture(({method})=>{if(method==='GET')return reply(definition);controller.abort();return reply({},405);});
 await assert.rejects(client.summary({}, {signal:controller.signal}),{name:'AbortError'});assert.equal(calls.length,2);
 const observed=fixture(()=>reply({ok:true}),{forcePost:true,onMetric:()=>{throw new Error('observer');}});assert.deepEqual(await observed.client.summary(),{ok:true});
});
test('Plain HTTP credentials are restricted to loopback',()=>{
 assert.throws(()=>createIntegrationReportClient('http://example.test/api/',{token:'key'}),/HTTPS/);
 assert.doesNotThrow(()=>createIntegrationReportClient('http://127.0.0.1:8097/api/',{token:'key'}));
});
