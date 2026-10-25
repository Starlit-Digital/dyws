import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {starterLayout,firstSpace,placeField,insertRow,removeRow,removeField} from '../public_html/plugins/order-format/model.js';
import {validOrderLayout,orderFields,applyOrderLayout} from '../public_html/dyws/order-layout.js';
const schema=JSON.parse(readFileSync(new URL('../plugins/order-format/schema.json',import.meta.url)));
test('Each starter layout covers the same stage contract as core, including essential controls',()=>{
 for(const [stage,definition] of Object.entries(schema)){
  assert.deepEqual(definition.fields.map(f=>f.id),orderFields[stage].fields);
  assert.deepEqual(definition.fields.filter(f=>f.required).map(f=>f.id),orderFields[stage].required);
  assert.equal(validOrderLayout(stage,starterLayout(definition)),true);
 }
});
test('Disabled, missing and invalid template layouts never modify built in markup',()=>{
 const untouched={get ownerDocument(){throw new Error('Should not inspect or change fallback DOM');},querySelectorAll(){throw new Error('Should not inspect fallback DOM');}};
 for(const layout of [null,undefined,{}, {rows:1,fields:[]}])assert.equal(applyOrderLayout({stage:'checkout',root:untouched,layout}),false);
 const layout=starterLayout(schema.checkout);layout.fields=layout.fields.filter(f=>f.id!=='phone');assert.equal(validOrderLayout('checkout',layout),false);
});
test('Canvas moves and swaps fields without duplicate controls or overlaps',()=>{
 const layout=starterLayout(schema.checkout),name=layout.fields.find(f=>f.id==='name'),phone=layout.fields.find(f=>f.id==='phone');
 const moved=placeField(layout,name,phone.row,phone.column);
 assert.deepEqual(moved.fields.find(f=>f.id==='phone'),{...phone,row:name.row,column:name.column});assert.equal(validOrderLayout('checkout',moved),true);
 assert.equal(layout.fields.find(f=>f.id==='name').column,1);
 assert.throws(()=>placeField(layout,{...name,span:2},1,1),/occupied/);
});
test('Rows can be inserted, empty rows removed and a field centered across both columns',()=>{
 let layout=starterLayout(schema.review);const deliveryRow=layout.fields.find(f=>f.id==='delivery').row;layout=insertRow(layout,2);assert.equal(layout.fields.find(f=>f.id==='delivery').row,deliveryRow+1);
 const name=layout.fields.find(f=>f.id==='name');layout=placeField(layout,{...name,span:2,align:'center',vertical:'center'},2,1);
 assert.equal(validOrderLayout('review',layout),true);assert.throws(()=>removeRow(layout,2),/empty/);
 layout=insertRow(layout,1);layout=removeRow(layout,1);assert.equal(validOrderLayout('review',layout),true);
});
test('Optional fields can be added and removed while essential fields stay available',()=>{
 let layout=starterLayout(schema.checkout);const city=schema.checkout.fields.find(f=>f.id==='city'),spot=firstSpace(layout,city.span);
 layout=placeField(layout,{id:city.id,span:1,align:'left',vertical:'top'},spot.row,spot.column);assert.equal(validOrderLayout('checkout',layout),true);
 layout=removeField(layout,'city',city);assert.equal(validOrderLayout('checkout',layout),true);
 assert.throws(()=>removeField(layout,'street',schema.checkout.fields.find(f=>f.id==='street')),/must stay/);
});
test('Runtime rejects malformed rows, unknown fields, executable alignment strings and overlapping cells',()=>{
 const base=starterLayout(schema.cart);
 for(const patch of [{row:0},{row:31},{column:0},{span:3},{id:'unknown'},{align:'left; color:red'},{vertical:'absolute'}]){const layout=structuredClone(base);Object.assign(layout.fields[0],patch);assert.equal(validOrderLayout('cart',layout),false);}
 const overlap=structuredClone(base);overlap.fields[1].row=1;assert.equal(validOrderLayout('cart',overlap),false);
 const noActions=structuredClone(base);noActions.fields=noActions.fields.filter(f=>f.id!=='actions');assert.equal(validOrderLayout('cart',noActions),false);
});
