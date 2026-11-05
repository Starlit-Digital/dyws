import test from 'node:test';
import assert from 'node:assert/strict';
// Only registration globals are needed. The tested method uses injected cart state.
globalThis.HTMLElement=class {};
globalThis.document={addEventListener(){}};
globalThis.customElements={define(){}};
const {DYWSOrdering}=await import('../public_html/dyws/component.js');
function ordering(){return {catalog:{taxBasisPoints:500,itemOrderCap:2,categories:[{items:[{id:'meal',name:'Meal',price:2500,active:true},{id:'drink',name:'Drink',price:500,variants:[{id:'small',name:'Small',price:500}]}]}]},lines:[{id:'old'}],isConnected:true,busy:false,reviewPanel:null,dialog:{open:false},checkoutDraft:[{name:'tipDollars',value:'20'}],pendingKey:'old',pendingFingerprint:'old',getAttribute(){return null;},persist(){this.persisted=true;},open(){this.opened=true;},showCart(){this.refreshed=true;}};}
const replace=(state,lines)=>DYWSOrdering.prototype.replaceCartDraft.call(state,lines);
test('reviewed draft uses current prices, clears checkout extras and opens the cart',async()=>{const o=ordering();await replace(o,[{id:'meal',quantity:2,price:1}]);assert.equal(o.lines[0].price,2500);assert.equal(o.lines[0].quantity,2);assert.equal(o.checkoutDraft,null);assert.equal(o.pendingKey,null);assert.equal(o.pendingFingerprint,null);assert.equal(o.opened,true);assert.equal(o.persisted,true);});
test('invalid drafts preserve the current cart',async()=>{for(const lines of [null,[],[{id:'missing',quantity:1}],[{id:'meal',quantity:3}],[{id:'meal',quantity:2},{id:'meal',quantity:1}],[{id:'meal',quantity:'1'}],[{id:'drink',quantity:1}]]){const o=ordering();await assert.rejects(replace(o,lines));assert.deepEqual(o.lines,[{id:'old'}]);assert.equal(o.persisted,undefined);}});
test('order value limit and busy or disconnected carts fail before replacement',async()=>{for(const change of [{busy:true},{reviewPanel:{}},{isConnected:false}]){const o=Object.assign(ordering(),change);await assert.rejects(replace(o,[{id:'meal',quantity:1}]));assert.deepEqual(o.lines,[{id:'old'}]);}const o=ordering();o.catalog.categories[0].items[0].price=100000;await assert.rejects(replace(o,[{id:'meal',quantity:2}]));assert.deepEqual(o.lines,[{id:'old'}]);});
test('an existing open cart refreshes instead of opening a second dialog',async()=>{const o=ordering();o.dialog.open=true;await replace(o,[{id:'drink',variant:'small',quantity:1}]);assert.equal(o.refreshed,true);assert.equal(o.opened,undefined);assert.equal(o.lines[0].variant,'small');});
