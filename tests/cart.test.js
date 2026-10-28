import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveItem,restoreCart,totals,lineKey,itemOrderCap,itemQuantity} from '../public_html/dyws/cart.js';
const catalog=JSON.parse(readFileSync(new URL('../examples/starlit-diner/catalog.json',import.meta.url)));
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

test('generic catalogs retain options and discard inactive products and invalid variants', () => {
 const shop=JSON.parse(readFileSync(new URL('../examples/general-store/catalog.json',import.meta.url)));
 const restored=restoreCart(shop,[{id:'tote',variant:'navy',quantity:2,price:1},{id:'notebook',variant:'fake',quantity:1}]);
 assert.equal(restored.length,1);assert.equal(restored[0].price,1900);
 shop.categories[0].items[1].active=false;assert.deepEqual(restoreCart(shop,restored),[]);
});

test('item cap defaults to ten and aggregates variants and duplicate saved lines',()=>{
 assert.equal(itemOrderCap({}),10);
 const saved=[{id:'sweet1',variant:'vanilla',quantity:7},{id:'sweet1',variant:'chocolate',quantity:7},{id:'sweet1',variant:'vanilla',quantity:2}];
 const restored=restoreCart(catalog,saved);
 assert.equal(itemQuantity(restored,'sweet1'),10);
 assert.deepEqual(restored.map(line=>line.quantity),[7,3]);
 assert.equal(itemQuantity(restoreCart({...catalog,itemOrderCap:3},saved),'sweet1'),3);
 assert.equal(itemQuantity(restoreCart({...catalog,itemOrderCap:20},saved),'sweet1'),16);
 for(const value of [0,100,1.5,'20',null])assert.equal(itemOrderCap({itemOrderCap:value}),10);
});

const pizza=JSON.parse(readFileSync(new URL('../examples/pizza/catalog.json',import.meta.url)));
test('pizza groups enforce bounds, charge per choice and canonicalize saved combinations',()=>{
 const selections={toppings:['cheese','pepper'],crust:['stuffed']};
 const line=resolveItem(pizza,'pizza','large',selections);
 assert.equal(line.price,2400);assert.match(line.option,/Crust: Stuffed crust/);assert.match(line.option,/Toppings: Peppers, Extra cheese/);
 for(const bad of [{},{crust:['thin'],toppings:['pepper']},{crust:['thin'],toppings:['pepper','cheese','olive']},{crust:['thin'],toppings:['cheese','cheese']},{...selections,unknown:[]},{...selections,crust:['unknown']}])assert.throws(()=>resolveItem(pizza,'pizza','large',bad));
 const restored=restoreCart(pizza,[{...line,price:1,quantity:1},{...line,selections:{crust:['stuffed'],toppings:['pepper','cheese']},quantity:2},{...line,selections:{crust:['thin'],toppings:['pepper','cheese']},quantity:1}]);
 assert.equal(restored.length,2);assert.equal(restored[0].quantity,3);assert.equal(restored[0].price,2400);assert.equal(restored[1].price,2100);
 assert.equal(lineKey('pizza','large',selections),lineKey('pizza','large',{crust:['stuffed'],toppings:['pepper','cheese']}));
});
