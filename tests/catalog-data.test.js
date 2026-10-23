import test from 'node:test';
import assert from 'node:assert/strict';
import {readCatalog} from '../public_html/dyws/catalog-data.js';
const catalog={currency:'CAD',categories:[]};
test('PHP catalog snapshot avoids duplicate API loading',async()=>{
 const element={getAttribute:()=> 'catalog-data'};let calls=0;
 assert.deepEqual(await readCatalog(element,{document:{getElementById:()=>({tagName:'META',content:JSON.stringify(catalog)})},fetch:()=>{calls++;}}),catalog);assert.equal(calls,0);
});
test('Standalone ordering embeds keep their configured catalog endpoint',async()=>{
 let endpoint;const result=await readCatalog({getAttribute:key=>key==='catalog'?'/shop/api/?route=/catalog':null},{document:{},fetch:async url=>{endpoint=url;return {ok:true,json:async()=>catalog};}});assert.equal(endpoint,'/shop/api/?route=/catalog');assert.deepEqual(result,catalog);
});
