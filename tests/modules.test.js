import test from 'node:test';
import assert from 'node:assert/strict';
import {createAPIClient} from '../public_html/dyws/api.js';
import {mountOrders} from '../public_html/dyws/orders.js';
import {mountManager} from '../public_html/dyws/manager.js';
import {mountGeneralSettings} from '../public_html/dyws/general-settings.js';
import {mountDriver} from '../public_html/dyws/driver.js';
import {createTracking} from '../public_html/dyws/tracking.js';

test('package controllers can be imported without reading or mutating a website DOM',()=>{
 for(const fn of [mountManager,mountOrders,mountGeneralSettings,mountDriver,createTracking])assert.equal(typeof fn,'function');
});
test('API client uses an explicit endpoint and preserves bearer and tracking authorization',async()=>{
 let seen;
 const api=createAPIClient('https://example.invalid/custom/orders.php?tenant=demo',{fetch:async(url,options)=>{seen={url,options};return {ok:true,json:async()=>({ok:true})};}});
 assert.deepEqual(await api('/manager/reports?from=2026-10-23&to=2026-10-24',{method:'POST',body:{amount:100},token:'test-manager',trackingToken:'test-tracking'}),{ok:true});
 assert.equal(seen.url.pathname,'/custom/orders.php');assert.equal(seen.url.searchParams.get('tenant'),'demo');
 assert.equal(seen.url.searchParams.get('route'),'/manager/reports');assert.equal(seen.url.searchParams.get('to'),'2026-10-24');
 assert.equal(seen.options.headers.Authorization,'Bearer test-manager');assert.equal(seen.options.headers['X-Tracking-Token'],'test-tracking');
 assert.equal(seen.options.referrerPolicy,'no-referrer');assert.equal(seen.options.body,'{"amount":100}');
});
test('API failures remain failures after extraction',async()=>{
 assert.throws(()=>createAPIClient(),/endpoint/);
 const api=createAPIClient('https://example.invalid/api',{fetch:async()=>({ok:false,json:async()=>({error:'Access denied.'})})});
 await assert.rejects(api('/manager/orders'),/Access denied/);
});
