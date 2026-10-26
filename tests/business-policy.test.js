import test from 'node:test';
import assert from 'node:assert/strict';
import {deliveryCharge,isOrderingOpen,locationPolicy} from '../public_html/dyws/business-policy.js';
const schedule=()=>({enabled:true,days:Array.from({length:7},()=>({mode:'closed',open:'09:00',close:'17:00'}))});
test('delivery fee supports flat, percentage, combined and location override with cent rounding',()=>{
 for(const [flat,bps,expected] of [[395,0,395],[0,250,37],[395,250,432],[0,0,0]]){
  const c={deliveryFee:flat,deliveryFeeBasisPoints:bps};assert.equal(deliveryCharge(c,1495,'delivery'),expected);assert.equal(deliveryCharge(c,1495,'pickup'),0);
 }
 assert.equal(deliveryCharge({deliveryFee:395},1,'delivery',{deliveryPricing:{flatFee:0,basisPoints:5000}}),1);
 assert.equal(deliveryCharge({deliveryFee:395},1495,'delivery',{deliveryPricing:{flatFee:200,basisPoints:1000}}),350);
});
test('weekly ordering uses local civil times, includes opening and excludes closing',()=>{
 const s=schedule();s.days[0]={mode:'hours',open:'09:00',close:'17:00'};
 for(const [at,open] of [['2026-10-26T14:59:00Z',false],['2026-10-26T15:00:00Z',true],['2026-10-26T22:59:59Z',true],['2026-10-26T23:00:00Z',false]])assert.equal(isOrderingOpen(s,'America/Edmonton',new Date(at)),open);
 assert.equal(isOrderingOpen(null),true);assert.equal(isOrderingOpen({...s,enabled:false}),true);
});
test('overnight Sunday carries into closed Monday, across daylight saving changes',()=>{
 const s=schedule();s.days[6]={mode:'hours',open:'22:00',close:'02:00'};
 assert.equal(isOrderingOpen(s,'America/Edmonton',new Date('2026-10-26T07:59:00Z')),true);
 assert.equal(isOrderingOpen(s,'America/Edmonton',new Date('2026-10-26T08:00:00Z')),false);
 s.days[6]={mode:'hours',open:'01:00',close:'02:00'};
 for(const at of ['2026-11-01T07:30:00Z','2026-11-01T08:30:00Z'])assert.equal(isOrderingOpen(s,'America/Edmonton',new Date(at)),true);
 s.days[0].mode='allDay';assert.equal(isOrderingOpen(s,'UTC',new Date('2026-10-26T23:59:00Z')),true);
});
test('branch inherits defaults unless it explicitly replaces a schedule',()=>{
 const s=schedule(),catalog={orderingHours:s,locationHours:null};
 assert.equal(locationPolicy(catalog,{orderingHours:null}).orderingHours,s);
 assert.equal(locationPolicy(catalog,{orderingHours:{...s,enabled:false}}).orderingHours.enabled,false);
});
