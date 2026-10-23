import test from 'node:test';
import assert from 'node:assert/strict';
import {sortOrders,matchesOrderStatus} from '../public_html/dyws/order-list.js';
test('Active orders precede recent history without mutating the input',()=>{
 const orders=[{id:'c',status:'completed',created_at:300},{id:'a',status:'accepted',created_at:1},{id:'b',status:'placed',created_at:20},{id:'d',status:'cancelled',created_at:400}];
 assert.deepEqual(sortOrders(orders).map(o=>o.id),['b','a','d','c']);assert.equal(orders[0].id,'c');
});
test('Active and completed groups include the correct pickup and delivery states',()=>{
 for(const status of ['placed','accepted','preparing','ready','out_for_delivery'])assert.equal(matchesOrderStatus(status,'active'),true);
 for(const status of ['delivered','completed','cancelled'])assert.equal(matchesOrderStatus(status,'active'),false);
 assert.equal(matchesOrderStatus('delivered','complete'),true);assert.equal(matchesOrderStatus('completed','complete'),true);assert.equal(matchesOrderStatus('cancelled','complete'),false);assert.equal(matchesOrderStatus('cancelled','cancelled'),true);assert.equal(matchesOrderStatus('cancelled',''),true);
});
