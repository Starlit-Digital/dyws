import test from 'node:test';
import assert from 'node:assert/strict';
import {createAPIClient} from '../public_html/dyws/api.js';
import {createRealtimeAPI} from '../public_html/dyws/realtime.js';
import {customerOrderHTML} from '../public_html/dyws/customer-account.js';

test('Customer API uses the guarded cookie channel and preserves structured dispatch rejections',async()=>{
 let seen;
 const api=createAPIClient('https://example.test/store/api/',{fetch:async(url,options)=>{seen=options;return {ok:false,status:409,json:async()=>({error:'Blocked by customer',code:'customer_blocked_driver',context:{driverId:'driver'}})};}});
 await assert.rejects(api('/customer/blocks',{customer:true,method:'POST',body:{driverId:'driver',action:'unblock'}}),error=>error.code==='customer_blocked_driver'&&error.context.driverId==='driver');
 assert.equal(seen.headers['X-DYWS-Customer'],'1');assert.equal(seen.referrerPolicy,'no-referrer');assert.equal(seen.headers.Authorization,undefined);
});
test('Customer requests and order creation always use HTTP so session cookies reach the store',async()=>{
 const requests=[];
 const api=createRealtimeAPI('https://example.test/api/',{config:{url:null},http:async(...args)=>{requests.push(args);return {ok:true};}});
 try{await api('/customer/orders',{customer:true});await api('/orders',{method:'POST',body:{}});assert.deepEqual(requests.map(r=>r[0]),['/customer/orders','/orders']);}finally{api.close();}
});
test('Customer history escapes report, driver, address and product content and only offers reports after delivery',()=>{
 const order={id:'DYWS-000000000001',status:'delivered',paymentStatus:'paid',createdAt:1700000000,fulfillment:'delivery',currency:'CAD',lines:[{quantity:1,name:'<img src=x onerror=alert(1)>',option:'<script>bad</script>',price:100}],driver:{id:'driver',name:'<b>Driver</b>'},deliveryAddress:'<iframe>address</iframe>',total:100,subtotal:100,tax:0,tip:0,deliveryFee:0,canReport:true,report:{reason:'conduct',details:'<svg onload=alert(1)>'}};
 const html=customerOrderHTML(order);assert(!/<(?:img|script|iframe|svg|b)[\s>]/.test(html));assert.match(html,/&lt;svg/);assert.match(html,/data-block/);
 const active=customerOrderHTML({...order,status:'out_for_delivery',canReport:false,report:null});assert.doesNotMatch(active,/data-report|data-block/);
});
