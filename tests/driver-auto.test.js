import test from 'node:test';
import assert from 'node:assert/strict';
import {mountDriver} from '../public_html/dyws/driver.js';
const settle=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
test('Signed in drivers automatically share on an active delivery, keep their active session while hidden and stop on logout',async()=>{
 const saved=new Map(['document','window','sessionStorage','navigator','isSecureContext'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 const listeners=new Map(),calls=[];let watches=0,clears=0;
 const nodes=new Map(['#error','#gps-state','#gps-details','#login','#driver-board','#deliveries','#logout','#login-form','#refresh'].map(key=>[key,{replaceChildren(){},querySelector(){return null;}}]));
 const root={querySelector:key=>nodes.get(key),querySelectorAll:()=>[]};
 const props={document:{hidden:false,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)},window:{addEventListener(){},removeEventListener(){}},sessionStorage:{getItem:()=> 'signed-in-token',removeItem(){}},navigator:{geolocation:{watchPosition(){watches++;return 1;},clearWatch(){clears++;},getCurrentPosition(){}}},isSecureContext:true};
 for(const [key,value]of Object.entries(props))Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
 let driver;
 try{
  const api=async(route,options)=>{calls.push({route,options});if(route==='/driver/orders')return {orders:[{id:'SG-000000000001',status:'out_for_delivery',total:100,address:'Fictional delivery address',customer_name:'Test',customer_phone:'7805550142',notes:''}]};if(route.endsWith('/start'))return {sharingToken:'test-share'};return {ok:true};};
  driver=mountDriver({root,api});await settle();assert.equal(watches,1);assert.ok(nodes.get('#deliveries').innerHTML.includes('Fictional delivery address'));assert.ok(!nodes.get('#deliveries').innerHTML.includes('data-gps'));
  document.hidden=true;listeners.get('visibilitychange')();await settle();assert.equal(clears,0);assert.ok(!calls.some(c=>c.route.endsWith('/stop')));
  document.hidden=false;listeners.get('visibilitychange')();await settle();assert.equal(watches,1);
  await nodes.get('#logout').onclick();assert.equal(clears,1);assert.equal(nodes.get('#driver-board').hidden,true);
 }finally{driver?.destroy();for(const [key,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
});
