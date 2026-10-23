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
test('Browser validators reject checkout, actions isolate errors, hooks can be added and removed after registration',async()=>{
 let context,destroyed=false;const called=[];
 const host=await createPluginHost({document:doc,api:async()=>({plugins:[manifest('hooks')]}),loadModule:async()=>({register(p){context=p;p.addValidator('checkout:validating',()=>{throw new Error('A note is required.');});p.onDestroy(()=>destroyed=true);p.addAction('test',()=>{throw new Error('Optional widget failed');},1);}})});
 const second=()=>called.push('second');context.addAction('test',second,2);
 await host.runAction('test');assert.deepEqual(called,['second']);assert.equal(host.errors.length,1);
 await assert.rejects(host.validate('checkout:validating'),/note is required/);
 context.removeAction('test',second);await host.runAction('test');assert.deepEqual(called,['second']);assert.equal(host.errors.length,1);
 const filter=value=>[...value,'extra'];context.addFilter('admin:navigation',filter);assert.deepEqual(await host.applyFilters('admin:navigation',[]),['extra']);context.removeFilter('admin:navigation',filter);assert.deepEqual(await host.applyFilters('admin:navigation',[]),[]);
 host.destroy();assert.equal(destroyed,true);
});
test('An unavailable validation plugin cannot silently bypass checkout checks',async()=>{
 const host=await createPluginHost({document:doc,api:async()=>({plugins:[{...manifest('required'),capabilities:['validation']}]}),loadModule:async()=>{throw new Error('Unavailable');}});
 await assert.rejects(host.validate('checkout:validating'),/required checkout plugin/);
});
test('Optional report renderer failures dispose tables and retain the core report fallback',async()=>{
 let disposed=0,cleared=0;const root={replaceChildren(){cleared++;}};
 const host=await createPluginHost({document:doc,api:async()=>({plugins:[manifest('reports')]}),loadModule:async()=>({register(p){p.addAction('admin:tables',({phase})=>{if(phase==='dispose')disposed++;});p.provide('reports.renderer',()=>{throw new Error('Broken chart');});}})});
 assert.equal(await host.renderReports({root,report:{}}),false);assert.equal(disposed,1);assert.equal(cleared,1);assert.equal(host.errors.length,1);
 const absent=await createPluginHost({document:doc,api:async()=>({plugins:[]})});assert.equal(await absent.renderReports({root,report:{}}),false);
});
