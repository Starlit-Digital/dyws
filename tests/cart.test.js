import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveItem,restoreCart,totals,lineKey} from '../public_html/ordering/cart.js';
const catalog=JSON.parse(readFileSync(new URL('../public_html/ordering/catalog.json',import.meta.url)));
test('currency uses integer cents and rounds tax once',()=>{
 assert.deepEqual(totals([{price:1495,quantity:2},{price:295,quantity:1}],500),{subtotal:3285,tax:164,total:3449});
 assert.deepEqual(totals([],500),{subtotal:0,tax:0,total:0});
});
test('saved carts discard tampered prices and invalid items or quantities',()=>{
 const result=restoreCart(catalog,[{id:'breakfast0',variant:'',price:1,quantity:2},{id:'missing',quantity:1},{id:'sides0',quantity:-1},{id:'sides1',quantity:100},{id:'sweet1',variant:'missing',quantity:1}]);
 assert.equal(result.length,1);assert.equal(result[0].price,1495);assert.equal(result[0].quantity,2);
});
test('variants are mandatory and retained as distinct lines',()=>{
 assert.throws(()=>resolveItem(catalog,'sweet1'));
 assert.equal(resolveItem(catalog,'sweet1','vanilla').price,795);
 assert.notEqual(lineKey('sweet1','vanilla'),lineKey('sweet1','chocolate'));
 const result=restoreCart(catalog,[{id:'sweet1',variant:'vanilla',quantity:1},{id:'sweet1',variant:'chocolate',quantity:2},{id:'sweet1',variant:'vanilla',quantity:2}]);
 assert.equal(result.length,2);assert.equal(result[0].quantity,3);
});
test('menu has five categories with seven items each with unique valid items',()=>{
 assert.equal(catalog.categories.length,5);const ids=new Set();for(const c of catalog.categories){assert.equal(c.items.length,7);for(const i of c.items){assert.ok(!ids.has(i.id));ids.add(i.id);assert.ok(Number.isSafeInteger(i.price)&&i.price>0);}}
});
