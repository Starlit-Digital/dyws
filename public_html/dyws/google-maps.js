import {createGPSCache} from './gps-cache.js';
let sdkPromise;
function googleSDK(key){
 if(globalThis.google?.maps?.importLibrary)return Promise.resolve(globalThis.google.maps);
 if(sdkPromise)return sdkPromise;
 sdkPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');let timer;
  const finish=error=>{clearTimeout(timer);delete globalThis.dywsGoogleMapsReady;if(error){script.remove();sdkPromise=null;reject(error);}else resolve(globalThis.google.maps);};
  globalThis.dywsGoogleMapsReady=()=>finish();script.onerror=()=>finish(new Error('Google Maps could not load.'));
  const query=new URLSearchParams({key,loading:'async',v:'quarterly',libraries:'marker',callback:'dywsGoogleMapsReady',auth_referrer_policy:'origin'});
  script.src='https://maps.googleapis.com/maps/api/js?'+query;script.async=true;script.referrerPolicy='strict-origin-when-cross-origin';timer=setTimeout(()=>finish(new Error('Google Maps timed out.')),15000);document.head.append(script);
 });return sdkPromise;
}
export async function makeGoogleMap(element,config,position,{showMarker=true}={}){
 const sdk=await googleSDK(config.browserKey);
 const [{Map},{AdvancedMarkerElement}]=await Promise.all([sdk.importLibrary('maps'),sdk.importLibrary('marker')]);
 const map=new Map(element,{center:position,zoom:15,mapId:config.mapId||'DEMO_MAP_ID',mapTypeControl:false,streetViewControl:false,fullscreenControl:true,gestureHandling:'cooperative'});
 const marker=new AdvancedMarkerElement({map:showMarker?map:null,position,title:'Delivery location'});
 let polylines=[],destinationMarker=null,routeAddress='',lastOrigin=null,routeAt=0,routePending=null,routeEpoch=0;
 function clearRoute(){routeEpoch++;polylines.forEach(line=>line.setMap(null));polylines=[];if(destinationMarker)destinationMarker.map=null;destinationMarker=null;routeAddress='';lastOrigin=null;routePending=null;}
 async function route(origin,address){
  if(!address){clearRoute();return '';}
  const moved=lastOrigin?Math.hypot((origin.lat-lastOrigin.lat)*111320,(origin.lng-lastOrigin.lng)*111320*Math.cos(origin.lat*Math.PI/180)):Infinity;
  if(routeAddress===address&&((polylines.length&&moved<100)||Date.now()-routeAt<60000))return polylines.length?'Driving route to the delivery address.':'';
  if(routePending)return routePending;
  if(routeAddress!==address)clearRoute();routeAddress=address;routeAt=Date.now();const epoch=routeEpoch;
  routePending=(async()=>{const {Route}=await sdk.importLibrary('routes');const {routes}=await Route.computeRoutes({origin,destination:address,travelMode:'DRIVING',fields:['path']});
   if(epoch!==routeEpoch)return '';if(!routes?.[0]?.path?.length)throw new Error('No driving route was found for this address.');
   const path=routes[0].path;polylines.forEach(line=>line.setMap(null));polylines=routes[0].createPolylines();polylines.forEach(line=>{line.setOptions({strokeColor:'#b62d39',strokeWeight:6});line.setMap(map);});
   if(destinationMarker)destinationMarker.map=null;destinationMarker=new AdvancedMarkerElement({map,position:path.at(-1),title:'Delivery destination: '+address});
   const {LatLngBounds}=await sdk.importLibrary('core');if(epoch!==routeEpoch)return '';const bounds=new LatLngBounds();path.forEach(point=>bounds.extend(point));map.fitBounds(bounds,40);lastOrigin=origin;return 'Driving route to the delivery address.';
  })().finally(()=>{if(epoch===routeEpoch)routePending=null;});return routePending;
 }
 return {update(p,title){marker.map=map;marker.position=p;marker.title=title;if(!polylines.length)map.panTo(p);},route,clear(){marker.map=null;clearRoute();},reset(center){marker.map=null;clearRoute();map.panTo(center);}};
}
/** One persistent map per view. Google SDK owns all Google content caching. */
export function createLocationRenderer({api,fallback,defaultCenter,makeMap=makeGoogleMap,document:doc=globalThis.document,now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout}){
 const root=doc.createElement('div'),canvas=doc.createElement('div'),reference=doc.createElement('div'),note=doc.createElement('p');
 root.className='dyws-location-view';canvas.className='dyws-google-map';note.className='dyws-note';root.append(canvas,reference,note);root.hidden=true;canvas.hidden=true;
 const ttl=900000,cache=createGPSCache({now,ttl});let map,creating,configuration,timer,signature,lastRole={singular:'Driver'},fallbackSignature,version=0,visible=false,destinationAddress='';
 function clear(){version++;visible=false;cache.clear();clearTimer(timer);map?.clear();root.hidden=true;reference.replaceChildren();signature=null;fallbackSignature=null;}
 function showFallback(p,role){if(p){const next=p.latitude+','+p.longitude+'|'+role.singular;if(next!==fallbackSignature){const node=fallback?.(p,role);reference.replaceChildren(...(node?[node]:[]));fallbackSignature=next;}}else reference.replaceChildren();reference.hidden=false;canvas.hidden=true;}
 async function refresh(){
  const current=version;let p=cache.get();if(!visible||(!p&&!defaultCenter)){clear();return;}root.hidden=false;
  configuration??=api('/maps/config').catch(()=>({enabled:false}));const config=await configuration;if(current!==version||!visible)return;
  p=cache.get();if(!p&&!defaultCenter){clear();return;}
  if(!config.enabled||!config.browserKey){showFallback(p,lastRole);note.textContent='Google Maps can be enabled in admin Settings.';return;}
  try{
   const position=p?{lat:p.latitude,lng:p.longitude}:defaultCenter;canvas.hidden=false;
   if(!map){creating??=makeMap(canvas,config,position,{showMarker:!!p});map=await creating;}
   if(current!==version||!visible){if(!visible)map.clear();return;}
   p=cache.get();if(p){const next=p.latitude+','+p.longitude+'|'+lastRole.singular;if(signature!==next){map.update({lat:p.latitude,lng:p.longitude},lastRole.singular+' location');signature=next;}note.textContent=(now()-p.recorded_at*1000>60000?'Last known position. ':'Latest shared position. ')+'No route or arrival estimate is calculated.';}
   else if(defaultCenter){map.reset?.(defaultCenter);map.clear();signature=null;note.textContent='Business area reference. Waiting for the driver location.';}
   else{clear();return;}
   reference.hidden=true;
   if(p&&destinationAddress&&map.route){try{const routeNote=await map.route({lat:p.latitude,lng:p.longitude},destinationAddress);if(current===version&&visible)note.textContent=(now()-p.recorded_at*1000>60000?'Last known driver position. ':'')+routeNote;}catch{if(current===version&&visible){note.textContent='Route unavailable. Check that Routes API is enabled for this key. ';const link=doc.createElement('a');link.href='https://www.google.com/maps/dir/?api=1&origin='+encodeURIComponent(p.latitude+','+p.longitude)+'&destination='+encodeURIComponent(destinationAddress)+'&travelmode=driving';link.textContent='Open driving directions';link.target='_blank';link.rel='noopener noreferrer';note.append(link);}}}
  }catch(error){creating=null;if(current!==version||!visible)return;p=cache.get();showFallback(p,lastRole);const reason=String(error?.message||'Map initialization failed.').replaceAll(config.browserKey,'[key]');note.textContent='Google Maps is unavailable: '+reason+' The location link is still available.';}
 }
 function render(position,role={singular:'Driver'},options={}){
  if(destinationAddress!==(options.destinationAddress||'')){version++;destinationAddress=options.destinationAddress||'';map?.route?.(null,'');}
  clearTimer(timer);lastRole=role;visible=true;cache.set(position);
  if(!cache.get()&&!defaultCenter){clear();return root;}
  if(cache.get())timer=setTimer(()=>{cache.clear();map?.clear();signature=null;void refresh();},Math.max(1,Math.min(120000,position.recorded_at*1000+ttl-now())));
  void refresh();return root;
 }
 render.clear=clear;render.destroy=clear;return render;
}
