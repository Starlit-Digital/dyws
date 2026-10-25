import test from 'node:test';
import assert from 'node:assert/strict';
import {captureCheckout,restoreCheckout} from '../public_html/dyws/checkout-draft.js';
test('Back navigation retains contact, disabled address metadata, notes and delivery selection',()=>{
 const field=(name,value,type='text')=>({name,value,type,dataset:{}});
 const street=field('addressLine1','123 Example St, Edmonton, AB');street.dataset={dywsAddressLine1:'123 Example St',dywsAddressDisplay:street.value};
 const before={elements:[field('customer','Example Customer'),field('phone','(780) 555-0142'),street,field('addressPostal','T5A 1A1','hidden'),field('notes','No onions'),{...field('fulfillment','delivery','radio'),checked:true},{...field('fulfillment','pickup','radio'),checked:false}]};
 const draft=captureCheckout(before);
 const after={elements:before.elements.map(input=>({...input,value:input.type==='radio'?input.value:'',dataset:{},checked:input.value==='pickup'}))};
 restoreCheckout(after,draft);
 assert.equal(after.elements[0].value,'Example Customer');assert.equal(after.elements[1].value,'(780) 555-0142');assert.deepEqual(after.elements[2].dataset,street.dataset);assert.equal(after.elements[3].value,'T5A 1A1');assert.equal(after.elements[4].value,'No onions');assert.equal(after.elements[5].checked,true);assert.equal(after.elements[6].checked,false);
});
test('removed locations and unrelated sensitive plugin fields are not restored',()=>{
 const form={elements:[{name:'locationId',value:'current',tagName:'SELECT',options:[{value:'current',disabled:false}]},{name:'password',value:'secret'}]};
 restoreCheckout(form,[{name:'locationId',value:'removed'}]);assert.equal(form.elements[0].value,'current');assert.equal(captureCheckout(form).length,1);
});
