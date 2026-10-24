import test from 'node:test';
import assert from 'node:assert/strict';
import {trackingDetails} from '../public_html/dyws/tracking-details.js';
const order={fulfillment:'delivery',createdAt:1792800000,deliveryAddress:'123 Example Street',business:{name:'Test & Cafe',phone:'+1 (780) 555 0142',pickupAddress:'456 Test Lane'},summary:{currency:'CAD',subtotal:2990,tax:169,deliveryFee:395,total:3554,lines:[{name:'Breakfast <script>',option:'Large & fresh',quantity:2,price:1495}]}};
test('Tracking renders saved amounts and escapes item and business text',()=>{
 const view=trackingDetails(order);assert.match(view.receipt,/2 × Breakfast &lt;script&gt;/);assert.match(view.receipt,/Large &amp; fresh/);
 assert.match(view.receipt,/\$29\.90/);assert.match(view.receipt,/\$3\.95/);assert.match(view.receipt,/\$35\.54/);assert.match(view.fulfillment,/123 Example Street/);
 assert.match(view.help,/tel:\+17805550142/);assert.match(view.help,/Test &amp; Cafe/);
});
test('Pickup uses business address and a missing phone offers no broken call link',()=>{
 const view=trackingDetails({...order,fulfillment:'pickup',business:{...order.business,phone:''}});
 assert.match(view.fulfillment,/456 Test Lane/);assert.doesNotMatch(view.fulfillment,/123 Example/);assert.doesNotMatch(view.receipt,/<dt>Delivery/);assert.doesNotMatch(view.help,/tel:/);
 assert.equal(trackingDetails({fulfillment:'pickup'}).receipt,'');
});
