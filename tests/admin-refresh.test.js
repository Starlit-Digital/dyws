import test from 'node:test';
import assert from 'node:assert/strict';
import {createGuardedRefresh,adminRefreshGroup,mountAdminRefresh} from '../public_html/dyws/admin-refresh.js';
function fixture(){const input={name:'name',value:'original',type:'text',matches:()=>true},form={elements:[input],contains:node=>node===input},doc={activeElement:null};let data={name:'original',revision:1},applied=0;const guard=createGuardedRefresh({read:async()=>data,apply:value=>{input.value=value.name;applied++;},forms:[form],initial:data,document:doc});return {input,form,doc,guard,change(value){data=value;},get applied(){return applied;}};}
test('Clean forms update, dirty fields keep values and revision until explicit reset',async()=>{
 const f=fixture();f.change({name:'remote',revision:2});await f.guard.refresh();assert.equal(f.input.value,'remote');assert.equal(f.applied,1);
 f.input.value='local draft';f.change({name:'remote again',revision:3});await f.guard.refresh();assert.equal(f.input.value,'local draft');assert.equal(f.applied,1);assert.equal(f.guard.pending,true);
 f.input.value='saved draft';f.guard.reset({name:'saved draft',revision:4});f.change({name:'latest',revision:5});await f.guard.refresh();assert.equal(f.input.value,'latest');assert.equal(f.guard.pending,false);
});
test('Focused clean inputs and unsaved secret fields are never overwritten',async()=>{
 const f=fixture();f.doc.activeElement=f.input;f.change({name:'remote',revision:2});await f.guard.refresh();assert.equal(f.applied,0);
 f.doc.activeElement=null;f.input.type='password';f.input.value='unsaved test key';await f.guard.refresh();assert.equal(f.applied,0);assert.equal(f.input.value,'unsaved test key');
});
test('Edits made while a request is pending win over its response',async()=>{
 let resolve,applied=0;const field={name:'name',value:'initial',type:'text'},form={elements:[field],contains:()=>false};
 const guard=createGuardedRefresh({read:()=>new Promise(r=>resolve=r),apply:()=>applied++,forms:[form],document:{},initial:{revision:1}});
 const pending=guard.refresh();field.value='typed during request';resolve({revision:2});await pending;assert.equal(applied,0);assert.equal(guard.pending,true);
});
test('A save or manual reload invalidates an older in flight read',async()=>{
 let resolve,applied=0;const guard=createGuardedRefresh({read:()=>new Promise(r=>resolve=r),apply:()=>applied++,initial:{revision:1}});
 const pending=guard.refresh();guard.reset({revision:3});resolve({revision:2});await pending;assert.equal(applied,0);
});
test('An open driver editor blocks account changes while independent GPS continues updating',async()=>{
 let editing=true,accounts=0,positions=0;
 const driver=createGuardedRefresh({read:async()=>({revision:2}),apply:()=>accounts++,blocked:()=>editing,initial:{revision:1}});
 const gps=createGuardedRefresh({read:async()=>({position:2}),apply:()=>positions++});
 await Promise.all([driver.refresh(),gps.refresh()]);assert.equal(accounts,0);assert.equal(positions,1);
 editing=false;await driver.refresh();assert.equal(accounts,1);
});
test('Resume events update registered sections, mutations and destruction protect stale writes',async()=>{
 const doc=Object.assign(new EventTarget(),{hidden:false}),win=new EventTarget();doc.defaultView=win;
 const notice={};const root={ownerDocument:doc,querySelector:()=>notice};let reads=0,applied=0,resolve,hold=false,stop=0;
 const group=adminRefreshGroup(root);group.register({read:async()=>{reads++;return hold?new Promise(r=>resolve=r):{reads};},apply:()=>applied++});
 const api={watch:()=>()=>stop++};const lifecycle=mountAdminRefresh({root,api,token:'test'});
 const settle=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
 doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));await settle();assert.equal(reads,0);
 doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));await settle();assert.equal(applied,1);
 win.dispatchEvent(new Event('focus'));await settle();win.dispatchEvent(new Event('online'));await settle();assert.equal(applied,3);
 hold=true;win.dispatchEvent(new Event('focus'));await settle();group.actionStart();group.actionEnd();resolve({reads});await settle();assert.equal(applied,3);
 lifecycle.destroy();win.dispatchEvent(new Event('focus'));doc.dispatchEvent(new Event('visibilitychange'));await settle();assert.equal(stop,1);assert.equal(reads,4);
});
