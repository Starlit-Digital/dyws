import test from 'node:test';
import assert from 'node:assert/strict';
import {readOrderSelection,orderSelectionURL,mountDriverOrderSelection} from '../public_html/dyws/order-selection.js';
test('Only an order identifier is carried in a local fragment',()=>{
 const url='https://example.test/diner/driver/?diagnostics=1',id='DYWS-000000000002';
 assert.equal(orderSelectionURL(url,id),url+'#order='+id);assert.equal(readOrderSelection(url+'#order='+id),id);
 for(const value of ['',null,'https://other.test','DYWS-<script>','DYWS-000000000002/other']){
  assert.equal(readOrderSelection(url+'#order='+encodeURIComponent(value)),null);
  assert.equal(orderSelectionURL(url,value),url);
 }
});
test('Driver order focus selects the requested card once and explains unavailable assignments',()=>{
 const id='DYWS-000000000002',view=new EventTarget();view.location={href:'https://example.test/driver/#order='+id};
 let notice,focuses=0,scrolls=0;
 const card=value=>({dataset:{order:value},setAttribute(name,value){this[name]=value;},removeAttribute(name){delete this[name];},focus(){focuses++;},scrollIntoView(){scrolls++;}});
 let cards=[card('DYWS-000000000001'),card(id)];
 const root={ownerDocument:{defaultView:view,createElement:()=>({setAttribute(){},remove(){}})},querySelector:()=>({prepend:value=>{notice=value;}}),querySelectorAll:()=>cards};
 const controller=mountDriverOrderSelection({root});controller.update();
 assert.equal(focuses,1);assert.equal(scrolls,1);assert.equal(cards[0]['data-dyws-selected-order'],undefined);assert.equal(cards[1]['data-dyws-selected-order'],'');
 cards=[card(id)];controller.update();assert.equal(focuses,1);assert.equal(cards[0]['data-dyws-selected-order'],'');
 cards=[];controller.update();assert.match(notice.textContent,/not in your active deliveries/);assert.equal(view.location.href,'https://example.test/driver/#order='+id);
 view.location.href='https://example.test/driver/';view.dispatchEvent(new Event('hashchange'));assert.equal(notice.hidden,true);
 controller.destroy();
});
