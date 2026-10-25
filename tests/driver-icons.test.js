import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {vehicleColors} from '../public_html/dyws/vehicle-colors.js';
import {driverIcons,driverIcon} from '../public_html/dyws/driver-icons.js';
import {makeGoogleMap} from '../public_html/plugins/google-maps/maps.js';
test('Fixed local vehicle artwork matches the server allowlist and defaults safely',()=>{
 const source=readFileSync(new URL('../modules/dyws/php/AdminAccounts.php',import.meta.url),'utf8');
 const ids=source.match(/PROFILE_ICONS=\[([^\]]+)\]/)[1].match(/'([^']+)'/g).map(value=>value.slice(1,-1));
 assert.deepEqual(driverIcons.map(icon=>icon.id),ids);
 for(const value of [null,undefined,'','__proto__','https://example.test/evil.svg','<script>'])assert.equal(driverIcon(value).id,'car');
 for(const icon of driverIcons){const svg=readFileSync(new URL(icon.url),'utf8');assert.match(svg,/<svg /);assert.doesNotMatch(svg,/<script|onload=|<image|<foreignObject|href=/);}
});
test('Google uses the chosen artwork and reuses the same marker on preference changes',async()=>{
 const old=globalThis.google,markers=[];
 class Map{panTo(){}}
 class Marker{constructor(options){Object.assign(this,options);markers.push(this);}}
 globalThis.google={maps:{importLibrary:async name=>name==='maps'?{Map}:{AdvancedMarkerElement:Marker}}};
 try{
  const map=await makeGoogleMap({}, {browserKey:'fixture'},{lat:1,lng:2},{document:{createElement:()=>({})}});
  assert.equal(markers.length,1);assert.equal(markers[0].content.src,driverIcon('car').url);
  map.update({lat:1,lng:2},'Alex location',{profileIcon:'van'});assert.equal(markers.length,1);assert.equal(markers[0].content.src,driverIcon('van').url);assert.equal(markers[0].title,'Alex location');
  map.update({lat:2,lng:3},'Alex location',{profileIcon:'bad'});assert.equal(markers[0].content.src,driverIcon('car').url);map.clear();assert.equal(markers[0].map,null);
 }finally{globalThis.google=old;}
});

test('The 32 vehicle swatches match the server choices and contain only fixed colours',()=>{
 const source=readFileSync(new URL('../modules/dyws/php/AdminAccounts.php',import.meta.url),'utf8');
 const names=source.match(/VEHICLE_COLORS=\[([^\]]+)\]/)[1].match(/'([^']+)'/g).map(value=>value.slice(1,-1));
 assert.deepEqual(vehicleColors.map(color=>color.name),names);assert.equal(new Set(names).size,32);
 for(const color of vehicleColors)assert.match(color.hex,/^#[a-f0-9]{6}$/);
});
