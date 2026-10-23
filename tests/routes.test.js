import test from 'node:test';
import assert from 'node:assert/strict';
import {makeGoogleMap} from '../public_html/dyws/google-maps.js';
test('Google route requests include traffic duration, reuse briefly, refresh and clear after completion',async()=>{
 const original=globalThis.google,realNow=Date.now;let time=1800000000000,requests=[],activeLines=0,fit=0;
 class Map{panTo(){}fitBounds(){fit++;}}
 class Marker{constructor(options){Object.assign(this,options);}}
 class Bounds{extend(){}}
 const Route={computeRoutes:async request=>{requests.push(request);return {routes:[{path:[{lat:53,lng:-113},{lat:54,lng:-114}],durationMillis:600000,distanceMeters:5000,createPolylines:()=>[{setOptions(){},setMap(value){activeLines+=value?1:-1;}}]}]};}};
 globalThis.google={maps:{importLibrary:async name=>({maps:{Map},marker:{AdvancedMarkerElement:Marker},core:{LatLngBounds:Bounds},routes:{Route}})[name]}};Date.now=()=>time;
 try{
  const map=await makeGoogleMap({}, {browserKey:'fixture'},{lat:53,lng:-113});
  const first=await map.route({lat:53,lng:-113},'Fictional destination');assert.equal(first.durationMillis,600000);assert.equal(requests[0].routingPreference,'TRAFFIC_AWARE');assert.ok(requests[0].fields.includes('durationMillis'));
  time+=5000;assert.deepEqual(await map.route({lat:53,lng:-113},'Fictional destination'),first);assert.equal(requests.length,1);
  time+=120000;await map.route({lat:53,lng:-113},'Fictional destination');assert.equal(requests.length,2);assert.equal(activeLines,1);assert.equal(fit,2);
  map.clear();assert.equal(activeLines,0);
 }finally{globalThis.google=original;Date.now=realNow;}
});
