import test from 'node:test';
import assert from 'node:assert/strict';
import {configureTimeZone,getTimeZone,formatTime,formatDateTime,dateKey} from '../public_html/dyws/date-time.js';
import {createAPIClient} from '../public_html/dyws/api.js';
import {deliveryStatus} from '../public_html/dyws/delivery-status.js';
test('display uses the selected zone across midnight and DST, without shifting instants',()=>{
 const instant=Date.parse('2026-03-08T07:30:00Z');
 configureTimeZone('America/Edmonton');assert.equal(dateKey(instant),'2026-03-08');assert.match(formatTime(instant/1000),/12:30.*MST/);
 configureTimeZone('America/Vancouver');assert.equal(dateKey(instant),'2026-03-07');
 configureTimeZone('Asia/Tokyo');assert.equal(dateKey(instant),'2026-03-08');assert.match(formatDateTime(instant/1000),/4:30.*(JST|GMT\+9)/);
 configureTimeZone('invalid');assert.equal(getTimeZone(),'Asia/Tokyo');
 configureTimeZone('America/Toronto');assert.match(formatTime(Date.parse('2026-03-08T06:30:00Z')/1000),/1:30.*EST/);assert.match(formatTime(Date.parse('2026-03-08T07:30:00Z')/1000),/3:30.*EDT/);
 configureTimeZone('UTC');const view=deliveryStatus({status:'out_for_delivery',fulfillment:'delivery',location:{recorded_at:instant/1000}},{now:instant,estimate:{calculatedAt:instant,durationMillis:600000}});assert.match(view.etaDetail,/7:40.*UTC/);
});
test('each successful API response refreshes the display timezone for open pages',async()=>{
 const client=createAPIClient('https://example.test/api',{fetch:async()=>({ok:true,headers:new Headers({'X-DYWS-Time-Zone':'Pacific/Auckland'}),json:async()=>({ok:true})})});await client('/health');assert.equal(getTimeZone(),'Pacific/Auckland');
 configureTimeZone('America/Edmonton');
});
