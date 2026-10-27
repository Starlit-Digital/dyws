import {googleSDK} from './maps.js';

/** Address to store preview, independent of driver GPS and live delivery tracking. */
export function createPickupMap({api,document:doc=globalThis.document,loadSDK=googleSDK}){
 const element=doc.createElement('div'),canvas=doc.createElement('div'),note=doc.createElement('p');
 canvas.className='dyws-pickup-map';canvas.setAttribute('aria-label','Driving route to the pickup location');
 note.setAttribute('role','status');element.append(canvas,note);element.hidden=true;
 let configuration,map,lines=[],markers=[],version=0,disposed=false;
 function clear(){version++;for(const line of lines)line.setMap(null);for(const marker of markers)marker.map=null;lines=[];markers=[];element.hidden=true;}
 async function update({origin,destination,name}){
  clear();if(disposed||!origin||!destination)return;const current=version;
  const stale=()=>disposed||current!==version;element.hidden=false;canvas.hidden=true;note.textContent='Loading route to '+name+'…';
  try{
   configuration??=api('/plugins/google-maps/config');const config=await configuration;if(stale())return;
   if(!config.enabled||!config.browserKey){note.textContent='Map preview unavailable. Open Google Maps directions below.';return;}
   const sdk=await loadSDK(config.browserKey);if(stale())return;
   const [{Map},{AdvancedMarkerElement},{Route},{LatLngBounds}]=await Promise.all(['maps','marker','routes','core'].map(library=>sdk.importLibrary(library)));if(stale())return;
   // No device coordinates, address persistence or server geocoding cache.
   const {routes}=await Route.computeRoutes({origin,destination,travelMode:'DRIVING',fields:['path']});if(stale())return;
   const route=routes?.[0];if(!route?.path?.length)throw new Error('No route');
   canvas.hidden=false;
   map??=new Map(canvas,{center:route.path[0],zoom:12,mapId:config.mapId||'DEMO_MAP_ID',mapTypeControl:false,streetViewControl:false,fullscreenControl:true,gestureHandling:'cooperative'});
   lines=route.createPolylines();for(const line of lines){line.setOptions({strokeColor:'#b62d39',strokeWeight:5});line.setMap(map);}
   markers=[new AdvancedMarkerElement({map,position:route.path[0],title:'Starting address: '+origin}),new AdvancedMarkerElement({map,position:route.path.at(-1),title:'Pickup: '+name})];
   const bounds=new LatLngBounds();route.path.forEach(point=>bounds.extend(point));map.fitBounds(bounds,40);
   note.textContent='Driving route from '+origin+' to '+name+'.';
  }catch{if(stale())return;configuration=null;canvas.hidden=true;note.textContent='Route preview unavailable. Check the address or open Google Maps directions below.';}
 }
 return {element,update,clear,destroy(){disposed=true;clear();element.remove();map=null;}};
}
