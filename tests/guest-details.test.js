import test from 'node:test';
import assert from 'node:assert/strict';
import {applySavedAddress,rememberPreference} from '../public_html/dyws/guest-details.js';
import {createAPIClient} from '../public_html/dyws/api.js';
import {createRealtimeAPI} from '../public_html/dyws/realtime.js';
import {captureCheckout,restoreCheckout} from '../public_html/dyws/checkout-draft.js';

test('restoring a saved address preserves structured lookup metadata and the unit',()=>{
 const inputs=new Map(['addressLine1','addressLine2','addressPostal'].map(name=>[name,{name,value:'',dataset:{}}]));
 const form={dataset:{dywsAddressAutocomplete:''},elements:{namedItem:name=>inputs.get(name)},ownerDocument:{createElement:()=>({})},append(input){inputs.set(input.name,input);}};
 applySavedAddress(form,{addressDetails:{line1:'123 Fictional Road',line2:'Unit 5',city:'Edmonton',region:'AB',postalCode:'T5A 0A1',country:'Canada'}});
 assert.equal(inputs.get('addressLine1').value,'123 Fictional Road, Edmonton, AB, T5A 0A1');
 assert.equal(inputs.get('addressLine1').dataset.dywsAddressLine1,'123 Fictional Road');
 assert.equal(inputs.get('addressLine2').value,'Unit 5');assert.equal(inputs.get('addressCountry').value,'Canada');
 form.dataset={};applySavedAddress(form,{addressDetails:{line1:'456 Example Avenue'}});
 assert.equal(inputs.get('addressLine1').value,'456 Example Avenue');assert.deepEqual(inputs.get('addressLine1').dataset,{});
 assert.equal(inputs.get('addressPostal').value,'');
});
test('back navigation preserves an explicit unchecked remember choice and a custom label',()=>{
 const form={elements:[{name:'rememberDetails',type:'checkbox',checked:false,value:'on'},{name:'defaultAddress',type:'checkbox',checked:true,value:'on'},{name:'addressLabel',value:'custom'},{name:'customAddressLabel',value:'Example studio'}]};
 const draft=captureCheckout(form);form.elements[0].checked=true;form.elements[1].checked=false;form.elements[3].value='';restoreCheckout(form,draft);
 assert.equal(form.elements[0].checked,false);assert.equal(form.elements[1].checked,true);
 assert.equal(form.elements[3].value,'Example studio');
 form.elements.namedItem=name=>form.elements.find(input=>input.name===name);
 assert.deepEqual(rememberPreference(form),{enabled:false,profileId:'',addressId:'',label:'Example studio',default:true});
 form.elements[0].disabled=true;assert.equal(rememberPreference(form),undefined);
});
test('back navigation keeps saved locality metadata when the lookup plugin is absent',()=>{
 const form={elements:[],ownerDocument:{createElement:()=>({})},append(input){this.elements.push(input);}};
 restoreCheckout(form,[{name:'addressCity',value:'Edmonton'},{name:'addressRegion',value:'AB'},{name:'addressCountry',value:'Canada'},{name:'password',value:'never restore'}]);
 assert.deepEqual(form.elements.map(input=>[input.name,input.value,input.type]),[['addressCity','Edmonton','hidden'],['addressRegion','AB','hidden'],['addressCountry','Canada','hidden']]);
});
test('guest requests always use HTTP with the CSRF header, even when WebSocket is enabled',async()=>{
 let seen;const http=createAPIClient('https://example.invalid/api/',{fetch:async(url,options)=>{seen={url,options};return {ok:true,json:async()=>({profileId:null,addresses:[]})};}});
 const api=createRealtimeAPI('https://example.invalid/api/',{http,config:{url:'wss://example.invalid'},WebSocket:class{constructor(){throw Error('Guest capability must not go to the relay');}}});
 await api('/guest-details',{guest:true});assert.equal(seen.options.headers['X-DYWS-Guest'],'1');assert.equal(seen.options.cache,'no-store');
 await api('/orders',{method:'POST',body:{rememberDetails:{enabled:true}},guest:true});assert.equal(seen.options.headers['X-DYWS-Guest'],'1');api.close();
});
