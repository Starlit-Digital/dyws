import test from 'node:test';
import assert from 'node:assert/strict';
import {mountOrders} from '../public_html/dyws/orders.js';
import {mountManager} from '../public_html/dyws/manager.js';
import {mountDriver} from '../public_html/dyws/driver.js';
import {mountOrderList} from '../public_html/dyws/order-list.js';
const settle=async()=>{for(let i=0;i<60;i++)await Promise.resolve();};
function fixture(){
 const doc=Object.assign(new EventTarget(),{hidden:false,activeElement:null,querySelector:()=>null});
 function element(){
  const nodes=new Map();
  const node={ownerDocument:doc,dataset:{},value:'',innerHTML:'',textContent:'',hidden:false,parentElement:{after(){}},
   append(){},prepend(){},remove(){},replaceChildren(){this.innerHTML='';},setAttribute(){},scrollIntoView(){},focus(){doc.activeElement=this;},matches:()=>false,
   contains(other){return other===this||[...nodes.values()].some(n=>n.contains(other));},
   querySelector(selector){if(selector==='#accepting-orders'||selector==='#delivery-runs'||selector==='article'||selector==='[data-dyws-order-initial]')return null;if(!nodes.has(selector))nodes.set(selector,element());return nodes.get(selector);},querySelectorAll:()=>[]};
  return node;
 }
 doc.createElement=element;const root=element(),win=new EventTarget();doc.body=root;
 win.location={href:'https://example.test/orders/'};win.history={replaceState(state,unused,url){win.location.href=url;}};doc.defaultView=win;
 const props={document:doc,window:win,sessionStorage:{getItem:()=> 'test-session',removeItem(){}},navigator:{}};
 const saved=Object.fromEntries(Object.keys(props).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 for(const [k,value] of Object.entries(props))Object.defineProperty(globalThis,k,{value,configurable:true,writable:true});
 return {doc,win,root,restore(){for(const [k,descriptor]of Object.entries(saved))if(descriptor)Object.defineProperty(globalThis,k,descriptor);else delete globalThis[k];}};
}
for(const page of ['orders','driver'])test(`${page} refreshes on visibility, focus and online, skips hidden pages and cleans up listeners`,async()=>{
 const f=fixture();let controller,reads=0,orders=[];
 const api=async route=>{assert.equal(route,page==='orders'?'/manager/orders':'/driver/orders');reads++;return {orders,drivers:[]};};
 api.watch=()=>()=>{};
 const mount=page==='orders'?mountOrders:mountDriver;
 try{
  controller=mount({root:f.root,api});await settle();assert.equal(reads,1);
  f.doc.hidden=true;f.doc.dispatchEvent(new Event('visibilitychange'));f.win.dispatchEvent(new Event('focus'));f.win.dispatchEvent(new Event('online'));await settle();assert.equal(reads,1);
  orders=[{id:'DYWS-000000000001',status:'ready',payment_status:'paid',total:100,currency:'CAD',fulfillment:'delivery',created_at:1700000000,customer_name:'Test',customer_phone:'7805550142',address:'Fictional address',lines:[],notes:''}];
  f.doc.hidden=false;f.doc.dispatchEvent(new Event('visibilitychange'));await settle();assert.equal(reads,2);
  const target=page==='orders'?f.root.querySelector('#orders').querySelector('.dyws-order-table'):f.root.querySelector('#deliveries');assert.match(target.innerHTML,/DYWS-000000000001/);
  orders=[];f.win.dispatchEvent(new Event('focus'));await settle();assert.equal(reads,3);assert.doesNotMatch(target.innerHTML,/DYWS-000000000001/);
  f.win.dispatchEvent(new Event('online'));await settle();assert.equal(reads,4);
  controller.destroy();controller=null;f.doc.dispatchEvent(new Event('visibilitychange'));f.win.dispatchEvent(new Event('focus'));f.win.dispatchEvent(new Event('online'));await settle();assert.equal(reads,4);
 }finally{controller?.destroy();f.restore();}
});

test('Order links reopen a completed order independently of filters and clear on close',async()=>{
 const f=fixture(),id='DYWS-000000000002',rendered=[];let list;
 f.win.location.href='https://example.test/orders/#order='+id;
 try{
  list=mountOrderList({root:f.root,renderOrder:order=>rendered.push(order.id)});
  const data={orders:[{id,status:'delivered',created_at:1700000000,total:100,currency:'CAD',fulfillment:'delivery',payment_status:'paid',customer_name:'Test'}]};
  await list.update(data);assert.equal(f.root.querySelector('.dyws-order-detail').hidden,false);assert.deepEqual(rendered,[id]);
  await list.update(data);assert.deepEqual(rendered,[id,id]);
  f.root.querySelector('[data-close-order]').onclick();assert.equal(f.win.location.href,'https://example.test/orders/');assert.equal(f.root.querySelector('.dyws-order-detail').hidden,true);
  f.win.location.href='https://example.test/orders/#order=DYWS-000000000099';f.win.dispatchEvent(new Event('hashchange'));
  assert.equal(f.root.querySelector('.dyws-order-detail').hidden,false);assert.deepEqual(rendered,[id,id]);
 }finally{list?.destroy();f.restore();}
});
test('Orders refreshes a focused order button without discarding a driver selection being edited',async()=>{
 const f=fixture();let controller,status='ready';
 const data=()=>({orders:[{id:'DYWS-000000000001',status,payment_status:'paid',total:100,currency:'CAD',fulfillment:'delivery',created_at:1700000000,customer_name:'Test',lines:[],driver_id:'first'}],drivers:[{id:'first',name:'First'},{id:'second',name:'Second'}]});
 const api=async()=>data();api.watch=()=>()=>{};
 try{
  controller=mountOrders({root:f.root,api});await settle();
  const list=f.root.querySelector('#orders'),table=list.querySelector('.dyws-order-table'),detail=list.querySelector('.dyws-order-detail'),content=list.querySelector('[data-order-content]');
  const button=table.querySelector('button');f.doc.activeElement=button;status='preparing';f.win.dispatchEvent(new Event('focus'));await settle();assert.match(table.innerHTML,/preparing/);
  table.onclick({target:{closest:()=>({dataset:{openOrder:'DYWS-000000000001'}})}});
  const select=detail.querySelector('select');select.matches=()=>true;select.value='second';f.doc.activeElement=select;const previous=content.innerHTML;
  status='ready';f.win.dispatchEvent(new Event('focus'));await settle();assert.equal(select.value,'second');assert.equal(content.innerHTML,previous);assert.match(table.innerHTML,/ready/);
 }finally{controller?.destroy();f.restore();}
});

test('Reports resumes with the chosen range intact and no page reload',async()=>{
 const f=fixture();let controller,reads=0;const requests=[];
 const api=async route=>{requests.push(route);reads++;return {currency:'CAD',orderCount:reads,activeOrders:0,cancelledOrders:0,orderedValue:0,averageOrderValue:0,captured:0,refunded:0,netCollected:0,netSales:0,netDeliveryFees:0,netTax:0,averagePreparationSeconds:null,averageDeliverySeconds:null,topItems:[]};};api.watch=()=>()=>{};
 try{controller=mountManager({root:f.root,api});await settle();f.root.querySelector('#from').value='2026-10-01';f.root.querySelector('#to').value='2026-10-20';f.win.dispatchEvent(new Event('focus'));await settle();assert.equal(reads,2);assert.match(requests[1],/from=2026-10-01&to=2026-10-20/);assert.equal(f.root.querySelector('#from').value,'2026-10-01');assert.match(f.root.querySelector('#stats').innerHTML,/Orders<strong>2/);}finally{controller?.destroy();f.restore();}
});
