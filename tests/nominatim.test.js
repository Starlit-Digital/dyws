import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAddressSearch} from '../public_html/plugins/nominatim/search.js';
test('only the latest address lookup can change suggestions',async()=>{
 const pending=[],results=[],statuses=[];
 const search=createAddressSearch({api:(_route,options)=>new Promise((resolve,reject)=>pending.push({options,resolve,reject})),onResults:rows=>results.push(rows),onStatus:text=>statuses.push(text)});
 const first=search.search('Old address'),second=search.search('New address');
 assert.equal(pending[0].options.signal.aborted,true);
 pending[1].resolve({results:[{label:'New'}]});await second;
 pending[0].resolve({results:[{label:'Old'}]});await first;
 assert.deepEqual(results.at(-1),[{label:'New'}]);
 const gone=search.search('Another address');search.destroy();pending[2].resolve({results:[{label:'Gone'}]});await gone;
 assert.ok(!results.some(rows=>rows[0]?.label==='Gone'));
 assert.deepEqual(pending[0].options.body,{query:'Old address'});
});
test('typing is debounced, short queries and cancellation do not send',async()=>{
 const jobs=new Map(),calls=[];let id=0;
 const search=createAddressSearch({api:async(_route,options)=>{calls.push(options.body);return {results:[]};},onResults:()=>{},onStatus:()=>{},schedule:fn=>{jobs.set(++id,fn);return id;},cancel:key=>jobs.delete(key)});
 search.queue('Edm');assert.equal(jobs.size,0);
 search.queue('Edmonton');search.queue('Calgary');assert.equal(jobs.size,1);
 await [...jobs.values()][0]();assert.deepEqual(calls,[{query:'Calgary'}]);
 search.queue('Another address');search.clear();assert.equal(jobs.size,0);
 search.destroy();await search.search('After destruction');assert.equal(calls.length,1);
});
test('lookup failure preserves manual entry and exposes no transport detail',async()=>{
 let status='';const search=createAddressSearch({api:async()=>{throw new Error('credential secret');},onResults:()=>{},onStatus:text=>status=text});
 await search.search('Edmonton');assert.match(status,/manually/);assert.doesNotMatch(status,/secret/);
});
