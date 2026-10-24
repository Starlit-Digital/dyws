import test from 'node:test';
import assert from 'node:assert/strict';
import {configureTimeZone,dateKey} from '../public_html/dyws/date-time.js';
import {orderDateRange,matchesOrderDate} from '../public_html/dyws/order-date-filter.js';

test('Orders presets use business dates rather than the browser or UTC day',()=>{
 configureTimeZone('America/Edmonton');const now=Date.parse('2026-10-25T02:00:00Z');
 assert.deepEqual(orderDateRange('today',now),{from:'2026-10-24',to:'2026-10-25'});
 assert.deepEqual(orderDateRange('yesterday',now),{from:'2026-10-23',to:'2026-10-24'});
 assert.deepEqual(orderDateRange('week',now),{from:'2026-10-19',to:'2026-10-26'});
 assert.deepEqual(orderDateRange('month',now),{from:'2026-10-01',to:'2026-11-01'});
 const range=orderDateRange('today',now);
 assert.equal(matchesOrderDate(dateKey(Date.parse('2026-10-24T05:59:59Z')),range),false);
 assert.equal(matchesOrderDate(dateKey(Date.parse('2026-10-24T06:00:00Z')),range),true);
 assert.equal(matchesOrderDate(dateKey(Date.parse('2026-10-25T05:59:59Z')),range),true);
 assert.equal(matchesOrderDate(dateKey(Date.parse('2026-10-25T06:00:00Z')),range),false);
 assert.equal(matchesOrderDate('2020-01-01',orderDateRange('',now)),true);
});
test('Week starts Monday, month and yesterday cross year and leap day boundaries',()=>{
 configureTimeZone('UTC');
 assert.deepEqual(orderDateRange('yesterday',Date.parse('2026-01-01T12:00:00Z')),{from:'2025-12-31',to:'2026-01-01'});
 assert.deepEqual(orderDateRange('week',Date.parse('2026-01-04T12:00:00Z')),{from:'2025-12-29',to:'2026-01-05'});
 assert.deepEqual(orderDateRange('week',Date.parse('2026-01-05T12:00:00Z')),{from:'2026-01-05',to:'2026-01-12'});
 assert.deepEqual(orderDateRange('month',Date.parse('2026-12-31T12:00:00Z')),{from:'2026-12-01',to:'2027-01-01'});
 assert.deepEqual(orderDateRange('yesterday',Date.parse('2028-03-01T12:00:00Z')),{from:'2028-02-29',to:'2028-03-01'});
});
test('Today includes the entire short and long daylight saving days',()=>{
 configureTimeZone('America/Edmonton');
 const spring=orderDateRange('today',Date.parse('2026-03-08T18:00:00Z'));
 for(const instant of ['2026-03-08T07:00:00Z','2026-03-09T05:59:59Z'])assert.equal(matchesOrderDate(dateKey(Date.parse(instant)),spring),true);
 assert.equal(matchesOrderDate(dateKey(Date.parse('2026-03-09T06:00:00Z')),spring),false);
 const fall=orderDateRange('today',Date.parse('2026-11-01T18:00:00Z'));
 for(const instant of ['2026-11-01T06:00:00Z','2026-11-02T06:59:59Z'])assert.equal(matchesOrderDate(dateKey(Date.parse(instant)),fall),true);
 assert.equal(matchesOrderDate(dateKey(Date.parse('2026-11-02T07:00:00Z')),fall),false);
});
