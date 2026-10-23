import test from 'node:test';
import assert from 'node:assert/strict';
import {decimalToMinor,createCatalogDraft} from '../public_html/dyws/catalog-editor.js';
test('editor converts decimal prices and percentage rates without fractional cents',()=>{
 assert.equal(decimalToMinor('14.95'),1495);assert.equal(decimalToMinor('1.01'),101);assert.equal(decimalToMinor('5'),500);assert.equal(decimalToMinor('0.09'),9);
 for(const value of ['','-2','1.005','NaN','12e2'])assert.throws(()=>decimalToMinor(value));
});
test('editing a draft preserves IDs, metadata and options without modifying saved data',()=>{
 const saved={categories:[{id:'goods',items:[{id:'one',name:'Original',metadata:{vendor:'Example'},variants:[{id:'navy',price:1900}]}]}]};
 const draft=createCatalogDraft(saved);draft.categories[0].items[0].name='Changed';
 assert.equal(saved.categories[0].items[0].name,'Original');assert.equal(draft.categories[0].items[0].id,'one');assert.deepEqual(draft.categories[0].items[0].metadata,{vendor:'Example'});assert.equal(draft.categories[0].items[0].variants[0].price,1900);
});
