import test from 'node:test';
import assert from 'node:assert/strict';
import {createGPSCache} from '../public_html/dyws/gps-cache.js';
import {createLocationRenderer} from '../public_html/dyws/google-maps.js';
const settle=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
const point={latitude:53.6,longitude:-113.4,recorded_at:1000,accuracy:8};
test('GPS cache expires from measurement time, rejects invalid fixes, clears and copies values',()=>{
 let time=1000000;const cache=createGPSCache({now:()=>time});cache.set(point);const p=cache.get();p.latitude=0;assert.equal(cache.get().latitude,53.6);time+=120000;assert.equal(cache.get(),null);assert.equal(cache.set(point),null);time=1000000;assert.equal(cache.set({...point,latitude:91}),null);cache.set(point);cache.clear();assert.equal(cache.get(),null);
});
function harness({enabled=true}={}){
 let creates=0,requests=0,updates=[],clears=0,time=1000000,next=0;const timers=new Map();
 const element=()=>({children:[],hidden:false,setAttribute(){},append(...nodes){this.children.push(...nodes);},replaceChildren(...nodes){this.children=nodes;}});
 const render=createLocationRenderer({api:async()=>{requests++;return {enabled,browserKey:'test',mapId:'DEMO_MAP_ID'};},document:{createElement:element},fallback:()=>element(),makeMap:async()=>{creates++;return {update:p=>updates.push(p),clear:()=>clears++};},now:()=>time,setTimer:(fn,delay)=>{timers.set(++next,{fn,delay});return next;},clearTimer:id=>timers.delete(id)});
 return {render,creates:()=>creates,requests:()=>requests,updates,clears:()=>clears,expire:async()=>{time+=900000;for(const t of timers.values())t.fn();await settle();}};
}
test('GPS updates reuse one map, SDK setup and marker, clearing hides stale coordinates',async()=>{
 const h=harness();const node=h.render(point);await settle();h.render(point);await settle();assert.equal(h.creates(),1);assert.equal(h.requests(),1);assert.equal(h.updates.length,1);
 assert.equal(h.render({...point,longitude:-113.5}),node);await settle();assert.equal(h.updates.length,2);h.render(null);await settle();assert.equal(node.hidden,true);assert.ok(h.clears()>0);h.render(point);await settle();assert.equal(h.creates(),1);assert.equal(node.hidden,false);await h.expire();assert.equal(node.hidden,true);
});
test('Without a configured key, reference maps work and Google SDK is never loaded',async()=>{
 const h=harness({enabled:false});const node=h.render(point);await settle();assert.equal(h.creates(),0);assert.equal(node.children[0].hidden,true);assert.equal(node.children[2].children.length,1);h.render.clear();assert.equal(node.hidden,true);
});
test('Clearing during asynchronous map creation cannot resurrect a GPS marker',async()=>{
 let resolve,clears=0,updates=0;const el=()=>({setAttribute(){},append(){},replaceChildren(){}});
 const render=createLocationRenderer({api:async()=>({enabled:true,browserKey:'test'}),document:{createElement:el},now:()=>1000000,makeMap:()=>new Promise(r=>resolve=r),setTimer:()=>1,clearTimer:()=>{}});
 const node=render(point);await settle();assert.equal(node.hidden,false);render.clear();resolve({clear:()=>clears++,update:()=>updates++});await settle();assert.equal(node.hidden,true);assert.equal(updates,0);assert.ok(clears>0);
});

test('Map skeleton stays until SDK settles and disappears on failure',async()=>{
 let reject;const el=()=>({children:[],hidden:false,setAttribute(){},append(...nodes){this.children.push(...nodes);},replaceChildren(...nodes){this.children=nodes;}});
 const render=createLocationRenderer({api:async()=>({enabled:true,browserKey:'test'}),document:{createElement:el},now:()=>1000000,makeMap:()=>new Promise((_,r)=>reject=r),fallback:el,setTimer:()=>1,clearTimer:()=>{}});
 const node=render(point);await settle();assert.equal(node.children[1].hidden,false);reject(new Error('Offline'));await settle();assert.equal(node.children[1].hidden,true);assert.equal(node.children[0].hidden,true);assert.equal(node.children[2].children.length,1);render.clear();
});
