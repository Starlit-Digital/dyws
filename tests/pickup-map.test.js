import test from 'node:test';
import assert from 'node:assert/strict';
import {createPickupMap} from '../public_html/plugins/google-maps/pickup.js';
function fixture(){
 const doc={createElement:()=>({children:[],hidden:false,textContent:'',setAttribute(){},append(...nodes){this.children.push(...nodes);},remove(){}})},requests=[],lines=[],markers=[];
 const libraries={maps:{Map:class{fitBounds(){}}},marker:{AdvancedMarkerElement:class{constructor(options){Object.assign(this,options);markers.push(this);}}},core:{LatLngBounds:class{extend(){}}},routes:{Route:{computeRoutes:request=>new Promise(resolve=>requests.push({request,resolve}))}}};
 const loadSDK=async()=>({importLibrary:async name=>libraries[name]});
 const result=()=>({routes:[{path:[{lat:1,lng:2},{lat:2,lng:3}],createPolylines:()=>{const line={setOptions(){},setMap(map){this.map=map;}};lines.push(line);return [line];}}]});
 return {doc,requests,lines,markers,loadSDK,result};
}
const settle=async()=>{for(let n=0;n<20;n++)await Promise.resolve();};
test('Changing address or store discards old routes, including out of order responses',async()=>{
 const f=fixture(),view=createPickupMap({document:f.doc,loadSDK:f.loadSDK,api:async()=>({enabled:true,browserKey:'test'})});
 const first=view.update({origin:'First address',destination:'First store',name:'North'});await settle();
 const second=view.update({origin:'Second address',destination:'Second store',name:'West'});await settle();assert.equal(f.requests.length,2);
 assert.equal(f.requests[1].request.origin,'Second address');assert.equal(f.requests[1].request.destination,'Second store');
 f.requests[1].resolve(f.result());await second;f.requests[0].resolve(f.result());await first;
 assert.equal(f.lines.length,1);assert.match(view.element.children[1].textContent,/Second address to West/);
 view.clear();assert.equal(f.lines[0].map,null);assert.equal(f.markers[0].map,null);assert.equal(view.element.hidden,true);
 const last=view.update({origin:'Third',destination:'Third store',name:'South'});await settle();view.destroy();f.requests[2].resolve(f.result());await last;assert.equal(f.lines.length,1);
});
test('Unavailable configuration or routes preserve a readable directions fallback',async()=>{
 const f=fixture();const view=createPickupMap({document:f.doc,loadSDK:()=>{throw new Error('Must not load');},api:async()=>({enabled:false})});await view.update({origin:'Example',destination:'Store',name:'Store'});assert.match(view.element.children[1].textContent,/Open Google Maps/);
 const failed=createPickupMap({document:f.doc,api:async()=>{throw new Error('offline');}});await failed.update({origin:'Example',destination:'Store',name:'Store'});assert.match(failed.element.children[1].textContent,/Route preview unavailable/);
});
