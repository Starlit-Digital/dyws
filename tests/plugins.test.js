import test from 'node:test';
import assert from 'node:assert/strict';
import {createPluginHost} from '../public_html/dyws/plugins.js';
const doc={createElement:()=>({}),head:{append(){}}};
const manifest=id=>({id,apiVersion:1,version:'1.0.0',browserModule:'index.js'});
test('Active browser plugins register providers, ordered actions and filters',async()=>{
 const called=[];let loaded;
 const host=await createPluginHost({document:doc,baseURL:'https://example.test/plugins/',api:async()=>({plugins:[manifest('sample')]}),loadModule:async url=>{loaded=url;return {register(p){p.provide('location.renderer',()=> 'renderer');p.addAction('test',()=>called.push(2),20);p.addAction('test',()=>called.push(1),10);p.addFilter('test',value=>value+1);}};}});
 assert.equal(loaded,'https://example.test/plugins/sample/index.js?v=1.0.0');assert.equal(host.createLocationRenderer(),'renderer');await host.runAction('test');assert.deepEqual(called,[1,2]);assert.equal(await host.applyFilters('test',3),4);
});
test('Disabled or unsafe manifest entries never import code, and core tracking has a map fallback',async()=>{
 let imports=0;const host=await createPluginHost({document:doc,baseURL:'https://example.test/plugins/',api:async()=>({plugins:[manifest('../evil'),{...manifest('sample'),browserModule:'https://evil.test/code.js'},{...manifest('sample'),apiVersion:99}]}),loadModule:async()=>{imports++;}});
 assert.equal(imports,0);let estimate='pending';const render=host.createLocationRenderer();const node=render({latitude:1},null,{onEstimate:value=>estimate=value});assert.equal(estimate,null);assert.equal(node.hidden,false);render.clear();assert.equal(node.hidden,true);
});
test('Broken plugins discard partial registration and allow other plugins to load',async()=>{
 const host=await createPluginHost({document:doc,api:async()=>({plugins:[manifest('bad'),manifest('good')]}),loadModule:async url=>({register(p){if(url.includes('/bad/')){p.provide('location.renderer',()=> 'bad');throw new Error('failed');}p.provide('location.renderer',()=> 'good');}})});
 assert.equal(host.createLocationRenderer(),'good');assert.equal(host.errors.length,1);
});
test('Plugin API failure leaves core functional and reports the missing plugins',async()=>{
 const host=await createPluginHost({document:doc,api:async()=>{throw new Error('offline');}});assert.equal(host.errors.length,1);assert.equal(typeof host.createLocationRenderer(),'function');
});
