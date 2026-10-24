import test from 'node:test';
import assert from 'node:assert/strict';
import {createTracking} from '../public_html/dyws/tracking.js';
const settle=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
function element(){return {dataset:{},ownerDocument:{createElement:()=>element()},replaceWith(){},children:[],nodes:new Map(),textContent:'',innerHTML:'',hidden:false,setAttribute(){},prepend(n){this.children.unshift(n);},append(n){this.children.push(n);},replaceChildren(...n){this.children=n;},contains(n){return this.children.includes(n);},remove(){this.removed=true;},querySelector(s){if(s==='button:disabled'||s==='.dyws-dismiss-tracking')return null;if(!this.nodes.has(s))this.nodes.set(s,element());return this.nodes.get(s);}};}
test('Customer observes driver completion, clears map and estimate, stops polling and retains confirmation',async()=>{
 const container=element();let notify,stop=0,clears=0,mapCallback,reads=0;const hooks=[];
 const now=Date.now();let data={status:'out_for_delivery',fulfillment:'delivery',paymentStatus:'paid',location:{recorded_at:now/1000,latitude:53,longitude:-113},gpsStale:false,events:[],updatedAt:now/1000};
 const api=async()=>{reads++;return data;};api.watch=(_,fn)=>{notify=fn;return ()=>stop++;};
 const renderer=(_,role,options)=>{mapCallback=options.onEstimate;return element();};renderer.clear=()=>clears++;
 const tracker=createTracking({api,container,plugins:{runAction:(name,payload)=>hooks.push({name,payload})},renderLocation:renderer,shopPage:'./',document:{createElement:element},now:()=>now});
 try{
  tracker.show('DYWS-000000000001','test-token');await settle();const panel=container.children[0];
  mapCallback({durationMillis:600000,calculatedAt:now});assert.equal(panel.querySelector('.dyws-arrival-value').textContent,'About 10 min');
  const oldCallback=mapCallback;
  data={...data,status:'delivered',location:null,events:[{status:'delivered',created_at:now/1000}]};notify();await settle();
  assert.equal(panel.querySelector('.dyws-tracking-status').textContent,'Delivered');assert.equal(panel.querySelector('.dyws-tracking-complete').hidden,false);
  assert.equal(panel.querySelector('.dyws-tracking-arrival').hidden,true);assert.equal(panel.querySelector('.dyws-tracking-map').children.length,0);assert.ok(clears>=2);assert.equal(stop,1);
  oldCallback({durationMillis:123000,calculatedAt:now});assert.equal(panel.querySelector('.dyws-arrival-value').textContent,'');
  notify();await settle();assert.equal(reads,2);assert.ok(!panel.removed);assert.equal(hooks.at(-1).name,'tracking:updated');assert.equal(hooks.at(-1).payload.order.status,'delivered');assert.equal(hooks.at(-1).payload.trackingToken,undefined);
 }finally{tracker.destroy();}
});
test('Network failures keep the last status and retry without pretending the order is complete',async()=>{
 const container=element();let notify,fail=false;
 const api=async()=>{if(fail)throw new Error('offline');return {status:'out_for_delivery',paymentStatus:'paid',fulfillment:'delivery',events:[],location:null};};api.watch=(_,fn)=>{notify=fn;return ()=>{};};
 const tracker=createTracking({api,container,document:{createElement:element}});
 try{tracker.show('order','token');await settle();fail=true;notify();await settle();const panel=container.children[0];assert.equal(panel.querySelector('.dyws-tracking-status').textContent,'Driver is on the way');assert.equal(panel.querySelector('.dyws-arrival-value').textContent,'Reconnecting');assert.match(panel.querySelector('.dyws-tracking-error').textContent,/Retrying/);assert.equal(panel.querySelector('.dyws-tracking-complete').hidden,true);fail=false;notify();await settle();assert.equal(panel.querySelector('.dyws-tracking-error').textContent,'');}finally{tracker.destroy();}
});
test('Returning to a visible customer page immediately fetches completion without waiting for polling',async()=>{
 const container=element(),doc=Object.assign(new EventTarget(),{hidden:false,createElement:element,defaultView:new EventTarget()});
 let reads=0,status='out_for_delivery';const api=async()=>{reads++;return {status,paymentStatus:'paid',fulfillment:'delivery',events:[],location:null,updatedAt:Date.now()/1000};};
 api.watch=()=>()=>{};
 const tracker=createTracking({api,container,document:doc});
 try{
  tracker.show('order','token');await settle();const panel=container.children[0];
  doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));await settle();assert.equal(reads,1);
  status='delivered';doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));await settle();
  assert.equal(reads,2);assert.equal(panel.querySelector('.dyws-tracking-status').textContent,'Delivered');
  doc.defaultView.dispatchEvent(new Event('online'));await settle();assert.equal(reads,2);
 }finally{tracker.destroy();}
});
test('Returning online refreshes and clears a failed update warning',async()=>{
 const container=element(),doc=Object.assign(new EventTarget(),{hidden:false,createElement:element,defaultView:new EventTarget()});
 let fail=true;const api=async()=>{if(fail)throw new Error('offline');return {status:'out_for_delivery',paymentStatus:'paid',fulfillment:'delivery',events:[],location:null};};api.watch=()=>()=>{};
 const tracker=createTracking({api,container,document:doc});
 try{tracker.show('order','token');await settle();const panel=container.children[0];assert.match(panel.querySelector('.dyws-tracking-error').textContent,/Retrying/);fail=false;doc.defaultView.dispatchEvent(new Event('online'));await settle();assert.equal(panel.querySelector('.dyws-tracking-error').textContent,'');assert.equal(panel.querySelector('.dyws-tracking-status').textContent,'Driver is on the way');}finally{tracker.destroy();}
});

test('Assigned driver details refresh and clear without exposing stale identity',async()=>{
 const container=element();let notify,fail=false;
 let data={status:'preparing',fulfillment:'delivery',paymentStatus:'unpaid',events:[],driver:null};
 const api=async()=>{if(fail)throw Object.assign(new Error('expired'),{status:404});return data;};api.watch=(_,fn)=>{notify=fn;return ()=>{};};
 const tracker=createTracking({api,container,document:{createElement:element}});
 try{
  tracker.show('order','token');await settle();const panel=container.children[0];assert.equal(panel.querySelector('.dyws-tracking-driver').hidden,true);
  data={...data,driver:{name:'Alex <Morgan>',vehicleType:'Sedan',vehicleColor:'Blue'}};notify();await settle();
  assert.equal(panel.querySelector('.dyws-tracking-driver').hidden,false);assert.equal(panel.querySelector('.dyws-driver-name').textContent,'Alex <Morgan>');assert.equal(panel.querySelector('.dyws-driver-vehicle').textContent,'Blue · Sedan');
  data={...data,driver:{name:'Taylor',vehicleType:'',vehicleColor:''}};notify();await settle();assert.equal(panel.querySelector('.dyws-driver-name').textContent,'Taylor');assert.equal(panel.querySelector('.dyws-driver-vehicle').hidden,true);
  fail=true;notify();await settle();assert.equal(panel.querySelector('.dyws-tracking-driver').hidden,true);assert.equal(panel.querySelector('.dyws-driver-name').textContent,'');
 }finally{tracker.destroy();}
});
