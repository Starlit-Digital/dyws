import test from 'node:test';
import assert from 'node:assert/strict';
import {deliveryStatus} from '../public_html/dyws/delivery-status.js';
const now=1800000000000;
const order={status:'out_for_delivery',fulfillment:'delivery',location:{recorded_at:now/1000},gpsStale:false,events:[]};
const estimate={durationMillis:480000,calculatedAt:now};
test('Arrival uses a finite Google duration, labels simulated GPS and never invents preparation time',()=>{
 const live=deliveryStatus(order,{now,estimate});assert.equal(live.etaValue,'About 8 min');assert.match(live.etaDetail,/traffic/);
 const demo=deliveryStatus({...order,locationSource:'simulated'},{now,estimate});assert.equal(demo.etaTitle,'Estimated arrival');assert.match(demo.etaDetail,/Simulated/);
 assert.equal(deliveryStatus({...order,status:'preparing'},{now,estimate}).etaValue,'Available after departure');
 assert.equal(deliveryStatus(order,{now,estimate:{...estimate,durationMillis:30000}}).etaValue,'Arriving soon');
 assert.equal(deliveryStatus({...order,fulfillment:'pickup',status:'ready'},{now}).etaValue,'Ready now');
});
test('Stale GPS, failed routes, expired estimates and connection loss withhold arrival times',()=>{
 assert.equal(deliveryStatus(order,{now:now+61000,estimate}).etaValue,'Location update delayed');
 assert.equal(deliveryStatus({...order,location:null},{now,estimate}).etaValue,'Waiting for location');
 assert.equal(deliveryStatus(order,{now,estimate:null}).etaValue,'Arrival estimate unavailable');
 assert.equal(deliveryStatus(order,{now,estimate:{...estimate,calculatedAt:now-121000}}).etaValue,'Calculating arrival');
 assert.equal(deliveryStatus(order,{now,estimate:{...estimate,durationMillis:NaN}}).etaValue,'Calculating arrival');
 assert.equal(deliveryStatus(order,{now,estimate,unavailable:true}).etaValue,'Reconnecting');
});
test('Only a confirmed terminal status completes the customer order and hides its estimate',()=>{
 const arrival=deliveryStatus(order,{now,estimate:{...estimate,durationMillis:0}});assert.equal(arrival.complete,false);
 const done=deliveryStatus({...order,status:'delivered',events:[{status:'delivered',created_at:now/1000}]},{now,estimate});
 assert.equal(done.complete,true);assert.equal(done.etaValue,'');assert.equal(done.stamp,now/1000);assert.equal(done.title,'Delivered');
 assert.equal(done.stages.at(-1).state,'current');
 assert.equal(deliveryStatus({...order,status:'cancelled'},{now}).complete,false);
});

test('Later run stops show queue progress instead of a misleading direct travel estimate',()=>{
 const later=deliveryStatus({...order,deliveryRun:{stopsAhead:2,isNext:false}},{now,estimate});assert.equal(later.etaValue,'2 stops before yours');assert.doesNotMatch(later.etaDetail,/8 min/);
 const next=deliveryStatus({...order,deliveryRun:{stopsAhead:0,isNext:true}},{now,estimate});assert.equal(next.etaValue,'About 8 min');
});

test('Pending confirmation, payment and connectivity have distinct customer guidance',()=>{
 for(const fulfillment of ['pickup','delivery']){
  const pending={...order,status:'placed',fulfillment,paymentProvider:'demo',paymentStatus:'unpaid'};
  const view=deliveryStatus(pending,{now});assert.equal(view.pending,true);assert.equal(view.etaValue,'Waiting for acceptance');assert.match(view.etaDetail,/no need to order again/);
  const paid=deliveryStatus({...pending,paymentProvider:'stripe',paymentStatus:'paid'},{now});assert.equal(paid.pending,true);
  const payment=deliveryStatus({...pending,paymentProvider:'stripe'},{now});assert.equal(payment.pending,false);assert.equal(payment.etaValue,'Waiting for payment');assert.doesNotMatch(payment.etaDetail,/departure/);
  const offline=deliveryStatus(pending,{now,unavailable:true});assert.equal(offline.pending,false);assert.equal(offline.etaValue,'Reconnecting');
  const accepted=deliveryStatus({...pending,status:'accepted'},{now});assert.equal(accepted.pending,false);assert.equal(accepted.stages.find(s=>s.state==='current').key,'accepted');assert.equal(accepted.etaValue,'Preparation');
  for(const status of ['preparing','ready','completed','delivered','cancelled'])assert.equal(deliveryStatus({...pending,status},{now}).pending,false);
 }
});
