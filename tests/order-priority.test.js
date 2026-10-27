import test from 'node:test';
import assert from 'node:assert/strict';
import {sortOrders,orderWorkView,orderDueAt} from '../public_html/dyws/order-priority.js';
import {matchesOrderStatus} from '../public_html/dyws/order-list.js';
test('Work views move scheduled pickup into preparation at the exact thirty minute boundary',()=>{
 const order={id:'scheduled',status:'placed',created_at:100,fulfillmentMeta:{scheduled:true,scheduledAt:5000}};
 assert.equal(orderDueAt(order),3200);assert.equal(orderWorkView(order,3199),'scheduled');assert.equal(orderWorkView(order,3200),'due');
 assert.equal(orderWorkView({...order,status:'completed'},100),'complete');assert.equal(orderWorkView({...order,status:'cancelled'},100),'cancelled');
});
test('Work sorts oldest due first, future schedules next and newest completed last',()=>{
 const orders=[{id:'future',status:'placed',created_at:1,fulfillmentMeta:{scheduled:true,scheduledAt:10000}},{id:'new',status:'placed',created_at:500},{id:'old',status:'ready',created_at:300},{id:'done-old',status:'completed',created_at:100},{id:'done-new',status:'delivered',created_at:600}];
 assert.deepEqual(sortOrders(orders).map(o=>o.id),['old','new','future','done-new','done-old']);
 assert.equal(orders[0].id,'future');
});
test('Active orders precede recent history without mutating the input',()=>{
 const orders=[{id:'c',status:'completed',created_at:300},{id:'a',status:'accepted',created_at:1},{id:'b',status:'placed',created_at:20},{id:'d',status:'cancelled',created_at:400}];
 assert.deepEqual(sortOrders(orders).map(o=>o.id),['a','b','d','c']);assert.equal(orders[0].id,'c');
});
test('Active and completed groups include the correct pickup and delivery states',()=>{
 for(const status of ['placed','accepted','preparing','ready','out_for_delivery'])assert.equal(matchesOrderStatus(status,'active'),true);
 for(const status of ['delivered','completed','cancelled'])assert.equal(matchesOrderStatus(status,'active'),false);
 assert.equal(matchesOrderStatus('delivered','complete'),true);assert.equal(matchesOrderStatus('completed','complete'),true);assert.equal(matchesOrderStatus('cancelled','complete'),false);assert.equal(matchesOrderStatus('cancelled','cancelled'),true);assert.equal(matchesOrderStatus('cancelled',''),true);
});
