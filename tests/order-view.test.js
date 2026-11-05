import test from 'node:test';
import assert from 'node:assert/strict';
import {createOrderView,lockOrderControls,focusOrder} from '../public_html/dyws/order-view.js';
import {reportsPreviewHTML} from '../public_html/dyws/reports-preview.js';
import {driverHistoryHTML} from '../public_html/dyws/driver-history.js';
function fixture(){
 const doc={activeElement:null},root={ownerDocument:doc,tabIndex:0,details:[],controls:[],contains(node){return this.controls.includes(node);},focus(){doc.activeElement=this;},querySelectorAll(selector){return selector==='details'?this.details:this.controls;}};
 const node=(tagName,dataset={},disabled=false)=>({tagName,dataset,disabled,isConnected:true,id:'',name:'',matches:selector=>tagName==='SELECT'&&selector.includes('select'),closest:()=>({dataset:{order:'DYWS-000000000001'}}),focus(){doc.activeElement=this;},scrollIntoView(){this.scrolled=true;}});
 return {doc,root,node};
}
test('Order refresh preserves disclosures, defers a selected draft and skips unchanged data',()=>{
 const {doc,root,node}=fixture();let draws=0;
 const view=createOrderView({root,render:()=>{draws++;root.details=[{id:'receipt',open:true}];root.controls=[node('SELECT',{assignment:''})];}});
 view.update({status:'ready'});root.details[0].open=false;
 assert.equal(view.update({status:'ready'}),false);assert.equal(draws,1);
 doc.activeElement=root.controls[0];assert.equal(view.update({status:'delivered'}),false);assert.equal(draws,1);
 assert.equal(view.update({status:'delivered'},{force:true}),true);assert.equal(draws,2);assert.equal(root.details[0].open,false);assert.equal(doc.activeElement,root.controls[0]);
 view.clear();doc.activeElement=null;view.update({status:'delivered'});assert.equal(draws,3);
});
test('Focus follows an enabled matching action and falls back when that action disappears',()=>{
 const {doc,root,node}=fixture();const first=node('BUTTON',{status:'ready'});root.controls=[first];doc.activeElement=first;
 const view=createOrderView({root,render:()=>{root.controls=[node('BUTTON',{status:'ready'},true)];}});view.update('changed');assert.equal(doc.activeElement,root);assert.equal(root.tabIndex,-1);
 const card=node('ARTICLE',{order:'DYWS-000000000001'});root.controls=[card];assert.equal(focusOrder(root,card.dataset.order),true);assert.equal(doc.activeElement,card);assert.equal(card.scrolled,true);assert.equal(focusOrder(root,'other'),false);
});
test('Failed actions restore original disabled states and leave replacement controls alone',()=>{
 const {root,node}=fixture(),enabled=node('BUTTON'),guarded=node('BUTTON',{},true),detached=node('BUTTON');root.controls=[enabled,guarded,detached];const unlock=lockOrderControls(root);assert.ok(root.controls.every(button=>button.disabled));detached.isConnected=false;const replacement=node('BUTTON',{},true);root.controls.push(replacement);unlock();assert.equal(enabled.disabled,false);assert.equal(guarded.disabled,true);assert.equal(detached.disabled,true);assert.equal(replacement.disabled,true);
});
test('Reports preview uses block text without controls, report values or data requests',()=>{
 const html=reportsPreviewHTML();assert.match(html,/Reports preview/);assert.match(html,/████/);assert.doesNotMatch(html,/<(?:button|input|select|a|form)\b|data-report-result|\$[0-9]/);assert.match(html,/aria-hidden="true"/);
});
test('Driver history exposes summaries and reversible archive actions without contact or GPS controls',()=>{
 const html=driverHistoryHTML([{id:'DYWS-000000000001',status:'delivered',payment_status:'paid',total:100,currency:'CAD',updated_at:1700000000,customer_phone:'PRIVATE',lines:[{name:'Fictional item',quantity:1}]}],{archived:true});assert.match(html,/<details/);assert.match(html,/data-archive="false"/);assert.match(html,/Restore order/);assert.doesNotMatch(html,/PRIVATE|data-status=|data-collect-payment|tel:|maps/);
});
