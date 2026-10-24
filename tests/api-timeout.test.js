import test from 'node:test';
import assert from 'node:assert/strict';
import {createAPIClient} from '../public_html/dyws/api.js';
const pending=signal=>new Promise((resolve,reject)=>{if(signal.aborted)reject(signal.reason);else signal.addEventListener('abort',()=>reject(signal.reason),{once:true});});
for(const phase of ['headers','body'])test(`Stalled ${phase} time out, and the next read succeeds`,async()=>{
 let attempts=0;
 const api=createAPIClient('https://example.test/api/',{fetch:async(url,{signal})=>{
  if(++attempts===1){if(phase==='headers')return pending(signal);return {ok:true,json:()=>pending(signal)};}
  return {ok:true,json:async()=>({status:'delivered'})};
 }});
 await assert.rejects(api('/tracking/order',{timeoutMs:10}),{name:'TimeoutError'});
 assert.deepEqual(await api('/tracking/order'),{status:'delivered'});assert.equal(attempts,2);
});
test('Caller cancellation is preserved through a timed read',async()=>{
 const controller=new AbortController();
 const api=createAPIClient('https://example.test/api/',{fetch:async(url,{signal})=>pending(signal)});
 const request=api('/tracking/order',{signal:controller.signal});controller.abort();
 await assert.rejects(request,{name:'AbortError'});
});
test('Mutations do not acquire a timeout or automatically retry',async()=>{
 let attempts=0;
 const api=createAPIClient('https://example.test/api/',{fetch:async(url,{signal})=>{attempts++;assert.equal(signal,undefined);throw new Error('connection lost');}});
 await assert.rejects(api('/orders',{method:'POST',body:{}}),/connection lost/);assert.equal(attempts,1);
});
