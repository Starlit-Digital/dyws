import test from 'node:test';
import assert from 'node:assert/strict';
import {fulfillmentHTML,localParts} from '../public_html/dyws/fulfillment.js';
import {deliveryStatus} from '../public_html/dyws/delivery-status.js';
test('Local date defaults and saved fulfillment metadata retain the store time zone',()=>{
 assert.deepEqual(localParts(Date.parse('2030-01-07T19:30:00Z'),'America/New_York'),{date:'2030-01-07',time:'14:30'});
 const meta={version:1,type:'scheduled_pickup',label:'Scheduled pickup',scheduled:true,scheduledAtUtc:'2030-01-07T19:30:00Z',localDate:'2030-01-07',localTime:'14:30',timeZone:'America/New_York'};
 const html=fulfillmentHTML({fulfillmentMeta:meta});assert.match(html,/data-order-type="scheduled_pickup"/);assert.match(html,/data-pickup-date="2030-01-07"/);assert.match(html,/<time datetime="2030-01-07T19:30:00Z">/);
 assert.match(fulfillmentHTML({fulfillment:'delivery'}),/Delivery/);assert.match(fulfillmentHTML({fulfillment:'pickup'}),/As soon as ready/);
 assert.doesNotMatch(fulfillmentHTML({fulfillmentMeta:{...meta,label:'<script>',localDate:'"><script>'}}),/<script>/);
 const view=deliveryStatus({fulfillment:'pickup',status:'accepted',fulfillmentMeta:meta});assert.equal(view.etaTitle,'Scheduled pickup');assert.match(view.etaDetail,/2030-01-07/);
});
