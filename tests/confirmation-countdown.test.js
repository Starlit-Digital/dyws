import test from 'node:test';
import assert from 'node:assert/strict';
import {createConfirmationCountdown} from '../public_html/dyws/confirmation-countdown.js';

function setup(hidden=false){
 const doc=Object.assign(new EventTarget(),{hidden}),jobs=new Map(),ticks=[];let sequence=0,sends=0,pauses=0;
 const countdown=createConfirmationCountdown({document:doc,onTick:value=>ticks.push(value),onConfirm:()=>sends++,onPause:()=>pauses++,setTimer:fn=>{jobs.set(++sequence,fn);return sequence;},clearTimer:id=>jobs.delete(id)});
 return {doc,countdown,ticks,jobs,get sends(){return sends;},get pauses(){return pauses;},advance(){for(const [id,fn] of [...jobs]){jobs.delete(id);fn();}}};
}
test('Final review counts from ten and only submits at zero',()=>{
 const s=setup();assert.deepEqual(s.ticks,[10]);
 for(let n=9;n>0;n--){s.advance();assert.equal(s.ticks.at(-1),n);assert.equal(s.sends,0);}
 s.advance();assert.equal(s.ticks.at(-1),0);assert.equal(s.sends,1);assert.equal(s.jobs.size,0);
 s.countdown.confirm();assert.equal(s.sends,1);
});
test('Early confirmation wins once even if a timer callback is already queued',()=>{
 const s=setup(),stale=[...s.jobs.values()][0];s.countdown.confirm();stale();s.countdown.confirm();
 assert.equal(s.sends,1);assert.equal(s.jobs.size,0);
});
test('Back, close and disposal cancel any queued submission',()=>{
 const s=setup(),stale=[...s.jobs.values()][0];s.countdown.cancel();stale();s.countdown.confirm();
 assert.equal(s.sends,0);assert.equal(s.jobs.size,0);
});
test('Taking more time pauses indefinitely and still permits a deliberate send',()=>{
 const s=setup();s.advance();const stale=[...s.jobs.values()][0];s.countdown.pause();stale();s.countdown.pause();
 assert.equal(s.pauses,1);assert.equal(s.sends,0);assert.equal(s.jobs.size,0);assert.equal(s.ticks.at(-1),9);
 s.countdown.confirm();assert.equal(s.sends,1);
});
test('Switching away pauses, and returning never sends an unseen order',()=>{
 const s=setup();s.doc.hidden=true;s.doc.dispatchEvent(new Event('visibilitychange'));
 s.doc.hidden=false;s.doc.dispatchEvent(new Event('visibilitychange'));s.advance();
 assert.equal(s.pauses,1);assert.equal(s.sends,0);assert.equal(s.jobs.size,0);
 s.countdown.confirm();assert.equal(s.sends,1);
 const hidden=setup(true);assert.equal(hidden.pauses,1);assert.equal(hidden.jobs.size,0);hidden.countdown.cancel();
});
test('A timer also checks visibility when a visibility event was missed',()=>{
 const s=setup();s.doc.hidden=true;s.advance();assert.equal(s.pauses,1);assert.equal(s.sends,0);s.countdown.cancel();
});
