import test from 'node:test';
import assert from 'node:assert/strict';
import {createDriverGPS} from '../public_html/dyws/driver-gps.js';
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function harness({token='login',secure=true,uploadError}={}){
 let time=1800000000000,next=1,fix,error,cleared=0,unauthorized=0;
 const jobs=new Map(),calls=[],states=[];
 const api=async(route,options)=>{calls.push({route,...options});if(route.endsWith('/start'))return {sharingToken:'share'};if(route.endsWith('/location')&&uploadError)throw uploadError;return {ok:true};};
 const geolocation={watchPosition(success,failure){fix=success;error=failure;return 7;},clearWatch(){cleared++;},getCurrentPosition(success){fix=success;}};
 const timer=(fn,delay)=>{const id=next++;jobs.set(id,{fn,at:time+delay});return id;};
 const gps=createDriverGPS({api,getToken:()=>token,secure,geolocation,now:()=>time,setTimer:timer,clearTimer:id=>jobs.delete(id),setRepeater:()=>99,clearRepeater:()=>{},onState:s=>states.push(s),onUnauthorized:()=>unauthorized++});
 return {gps,calls,states,jobs,fix:(changes={})=>fix({coords:{latitude:53.61665,longitude:-113.39804,accuracy:8,...changes.coords},timestamp:time,...changes}),fail:code=>error({code}),cleared:()=>cleared,unauthorized:()=>unauthorized,advance:async ms=>{time+=ms;for(const [id,j]of [...jobs])if(j.at<=time){jobs.delete(id);j.fn();}await settle();}};
}
test('GPS requires login, HTTPS and explicit start',async()=>{
 const h=harness();assert.equal(h.calls.length,0);assert.equal(h.gps.orderId,null);
 for(const config of [{token:null},{secure:false}]){const x=harness(config);await x.gps.start('order');assert.equal(x.calls.length,0);assert.equal(x.gps.orderId,null);}
});
test('Device fix timestamp and authenticated sharing token reach the API',async()=>{
 const h=harness();await h.gps.start('order');h.fix({timestamp:1799999995000});await settle();
 const upload=h.calls.find(c=>c.route.endsWith('/location'));assert.equal(upload.token,'login');assert.equal(upload.body.recordedAt,1799999995);assert.equal(upload.body.sharingToken,'share');assert.equal(h.states.at(-1).position.accuracy,8);
 h.gps.stop();assert.equal(h.cleared(),1);assert.equal(h.gps.orderId,null);assert.ok(h.calls.some(c=>c.route.endsWith('/stop')));
});
test('Old, inaccurate and nonnumeric fixes are not uploaded',async()=>{
 const h=harness();await h.gps.start('order');h.fix({timestamp:1700000000000});h.fix({coords:{latitude:91,longitude:1,accuracy:4}});h.fix({coords:{latitude:1,longitude:1,accuracy:Infinity}});await settle();assert.equal(h.calls.filter(c=>c.route.endsWith('/location')).length,0);h.gps.stop();
});
test('Rapid fixes coalesce and stop ignores queued browser callbacks',async()=>{
 const h=harness();await h.gps.start('order');h.fix();await settle();await h.advance(1000);h.fix({coords:{latitude:53.62,longitude:-113.4,accuracy:8}});await h.advance(1000);h.fix({coords:{latitude:53.63,longitude:-113.4,accuracy:8}});await settle();assert.equal(h.calls.filter(c=>c.route.endsWith('/location')).length,1);
 await h.advance(3000);assert.equal(h.calls.filter(c=>c.route.endsWith('/location')).length,2);h.gps.stop();h.fix();await h.advance(30000);assert.equal(h.calls.filter(c=>c.route.endsWith('/location')).length,2);
});
test('Network failure retries only the latest fresh fix',async()=>{
 const h=harness({uploadError:new Error('offline')});await h.gps.start('order');h.fix();await settle();assert.match(h.states.at(-1).message,/Retrying/);await h.advance(5000);assert.equal(h.calls.filter(c=>c.route.endsWith('/location')).length,2);
 await h.advance(70000);assert.equal(h.calls.filter(c=>c.route.endsWith('/location')).length,2);h.gps.stop();
});
test('Expired authentication and denied permission stop capture',async()=>{
 const h=harness({uploadError:Object.assign(new Error('expired'),{status:401})});await h.gps.start('order');h.fix();await settle();assert.equal(h.gps.orderId,null);assert.equal(h.unauthorized(),1);assert.equal(h.cleared(),1);
 const x=harness();await x.gps.start('order');x.fail(1);assert.equal(x.gps.orderId,null);assert.match(x.states.at(-1).message,/permission denied/);
});
test('Simulation uses the same authenticated upload without requesting device GPS',async()=>{
 const h=harness({secure:false});await h.gps.start('order',{simulatePosition:()=>({latitude:1,longitude:2,accuracy:8})});await settle();assert.equal(h.calls[0].body.source,'simulated');assert.equal(h.states.at(-1).source,'simulated');assert.ok(h.calls.some(c=>c.route.endsWith('/location')));h.gps.stop();assert.equal(h.cleared(),0);
});

test('Stationary fixes reuse the cached point until the 30 second heartbeat',async()=>{
 const h=harness();await h.gps.start('order');h.fix();await settle();await h.advance(5000);h.fix();await settle();assert.equal(h.calls.filter(c=>c.route.endsWith('/location')).length,1);await h.advance(25000);assert.equal(h.calls.filter(c=>c.route.endsWith('/location')).length,2);h.gps.stop();
});

test('A delivery run uses one watcher and one authenticated upload for all stops',async()=>{
 const h=harness();await h.gps.start('RUN-000000000001',{scope:'run'});h.fix();await settle();
 assert.equal(h.gps.scope,'run');assert.equal(h.calls.filter(c=>c.route.endsWith('/location')).length,1);
 assert.equal(h.calls.find(c=>c.route.endsWith('/location')).route,'/driver/runs/RUN-000000000001/location');
 h.gps.stop();assert.equal(h.cleared(),1);assert.ok(h.calls.some(c=>c.route==='/driver/runs/RUN-000000000001/location/stop'));
});
