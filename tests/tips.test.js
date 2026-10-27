import test from 'node:test';
import assert from 'node:assert/strict';
import {tipCents} from '../public_html/dyws/tips.js';
import {captureCheckout,restoreCheckout} from '../public_html/dyws/checkout-draft.js';
import {renderDriverTips} from '../public_html/dyws/driver-tips.js';
test('Whole dollar tips use cents and reject decimals, signs, exponents and overflow',()=>{
 assert.equal(tipCents('5'),500);assert.equal(tipCents('0'),0);assert.equal(tipCents('005'),500);assert.equal(tipCents('',false),0);assert.equal(tipCents('999999'),99999900);
 for(const value of ['', '2.50','-1','+2','1e3','1,000','1000000',' 2 ',NaN,5])assert.throws(()=>tipCents(value),/whole dollars/);
});
test('Back navigation retains the optional tip and amount without browser persistence',()=>{
 const form={elements:[{name:'addTip',type:'hidden',value:'1'},{name:'tipDollars',type:'text',value:'7'}]};
 const draft=captureCheckout(form);form.elements[0].value='0';form.elements[1].value='';restoreCheckout(form,draft);
 assert.equal(form.elements[0].value,'1');assert.equal(form.elements[1].value,'7');assert.equal(tipCents('7',false),0);
});
test('Driver tip empty state explains when tips are earned and escapes content',()=>{
 const html=renderDriverTips({timeZone:'<script>',currencies:[],recentOrders:[]});assert.match(html,/No earned tips yet/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
});
