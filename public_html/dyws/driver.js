import {formatTime} from './date-time.js';
import {pluginSlot} from './plugin-ui.js?v=32';
import {escapeHTML as esc,money,statusText} from './api.js';
import {createDriverGPS} from './driver-gps.js';
export function mountDriver({root=document,api,storageKey='starlit-go-driver',renderLocation,simulatePosition,testLocationName='Configured test origin',plugins}) {
 if(typeof api!=='function')throw new TypeError('A DYWS API client is required.');
 let token=sessionStorage.getItem(storageKey),loading=false,changing=false,unwatch=null,watchedToken=null,attemptedOrder=null,retryAfter=0,permission,currentDelivery=null,latestPosition=null,reloadPending=false,revision=0;
 const feedback=root.querySelector('#delivery-feedback');
 const error=root.querySelector('#error'),state=root.querySelector('#gps-state'),details=root.querySelector('#gps-details');
 function display(){if(token!==watchedToken){unwatch?.();watchedToken=token;unwatch=token?api.watch?.({scope:'operator',token,interval:10000},()=>load()):null;}root.querySelector('#login').hidden=!!token;root.querySelector('#driver-board').hidden=!token;}
 function signedOut(){if(feedback)feedback.textContent='';latestPosition=null;currentDelivery=null;renderLocation?.clear?.();attemptedOrder=null;token=null;sessionStorage.removeItem(storageKey);root.querySelector('#deliveries').replaceChildren();display();}
 const gps=createDriverGPS({api,getToken:()=>token,onUnauthorized:signedOut,onState:s=>{
  state.textContent=s.message;const mapRoot=root.querySelector('#driver-map');if(mapRoot&&renderLocation){if(s.position)latestPosition={...s.position,recorded_at:s.position.recordedAt};if(!s.active)latestPosition=null;const view=renderLocation(latestPosition,undefined,{destinationAddress:currentDelivery?.address});if(view&&!mapRoot.contains(view))mapRoot.replaceChildren(view);}
  if(details){if(!s.active)details.textContent='';else if(s.position)details.textContent=(s.source==='simulated'?'Test route · ':'Device GPS · ')+s.orderId+' · Last shared '+formatTime(s.sharedAt/1000)+' · '+s.position.latitude.toFixed(5)+', '+s.position.longitude.toFixed(5);else details.textContent=s.orderId+' · '+(s.source==='simulated'?'Simulated test route':'Device GPS');}

 }});
 root.querySelector('#logout').onclick=async()=>{gps.stop();const old=token;signedOut();try{await api('/logout',{method:'POST',body:{},token:old});}catch{}};
 root.querySelector('#login-form').onsubmit=async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;try{const f=new FormData(e.target);const data=await api('/login',{method:'POST',body:{role:'driver',driverId:f.get('driverId'),password:f.get('password')}});token=data.token;sessionStorage.setItem(storageKey,token);try{const config=await api('/driver/gps-config',{token});simulatePosition=config.testLocation?()=>config.testLocation:undefined;testLocationName=config.testLocation?.name||'Configured test origin';}catch{}e.target.elements.password.value='';display();await load();}catch(e){error.textContent=e.message;}finally{button.disabled=false;}};
 async function change(id,status){
  if(changing)return;changing=true;error.textContent='';if(feedback)feedback.textContent='';
  root.querySelectorAll('[data-status]').forEach(button=>{button.disabled=true;});
  try{
   await api('/driver/orders/'+id+'/status',{method:'POST',token,body:{status}});revision++;
   if(status==='delivered'){
    if(gps.orderId===id)gps.stop('Delivery complete. GPS is off.');
    latestPosition=null;renderLocation?.clear?.();
    if(feedback)feedback.textContent='Delivery complete · '+id+'. The customer can now see Delivered.';
   }else if(feedback)feedback.textContent='Delivery started. The customer can follow your progress.';
   await load();
  }catch(e){error.textContent=e.message;if(e.status===401){gps.stop();signedOut();}}
  finally{changing=false;root.querySelectorAll('[data-status]').forEach(button=>{button.disabled=false;});}
 }
 async function load(){if(!token)return;if(loading){reloadPending=true;return;}loading=true;const login=token,readRevision=revision;try{
  const data=await api('/driver/orders',{token:login});if(token!==login)return;if(readRevision!==revision){reloadPending=true;return;}error.textContent='';
  if(gps.orderId&&!data.orders.some(o=>o.id===gps.orderId&&o.status==='out_for_delivery'))gps.stop('This delivery is no longer active. GPS is off.');
  root.querySelector('#deliveries').innerHTML=data.orders.length?data.orders.map(o=>`<article data-order="${o.id}"><h2>${o.id}</h2><p>${esc(statusText(o.status))} · ${money(o.total)}</p><p>${esc(o.customer_name)} · ${esc(o.customer_phone)}<br>${esc(o.address)}</p><p>${esc(o.notes)}</p><div class="dyws-actions">${o.status==='ready'?'<button data-status="out_for_delivery">Picked up, start delivery</button>':'<button data-status="delivered">Complete delivery</button>'}</div></article>`).join(''):'<p>No active deliveries. You’re all caught up.</p>';
  root.querySelectorAll('[data-order]').forEach(card=>{
   const id=card.dataset.order;
   card.querySelector('[data-status]')?.addEventListener('click',e=>change(id,e.target.dataset.status));
  });
  root.querySelectorAll('[data-status]').forEach(button=>{button.disabled=changing;});
  const current=data.orders.find(o=>o.id===gps.orderId&&o.status==='out_for_delivery')||data.orders.find(o=>o.status==='out_for_delivery');
  currentDelivery=current;if(!current)latestPosition=null;if(simulatePosition&&current?.gps?.location){latestPosition=current.gps.location;state.textContent='Test location: '+testLocationName+'. Device GPS is not used.';details.textContent=current.id+' · Updated '+formatTime(latestPosition.recorded_at);}const mapRoot=root.querySelector('#driver-map');if(mapRoot&&renderLocation){const view=renderLocation(latestPosition,undefined,{destinationAddress:current?.address});if(view&&!mapRoot.contains(view))mapRoot.replaceChildren(view);}
  if(current&&(simulatePosition||permission?.state!=='denied')&&!document.hidden&&!gps.orderId&&(attemptedOrder!==current.id||Date.now()>retryAfter)){attemptedOrder=current.id;retryAfter=Date.now()+60000;void gps.start(current.id,{simulatePosition});}
  if(!current){attemptedOrder=null;state.textContent='GPS starts automatically when an assigned delivery is on the way.';}
  if(plugins)void plugins.runAction('driver:orders',{root:pluginSlot(root.querySelector('#deliveries'),'driver'),orders:data.orders});
 }catch(e){if(token!==login)return;error.textContent=e.message;if(e.status===401||e.status===403){gps.stop('Please sign in again before sharing GPS.');signedOut();}}finally{loading=false;if(reloadPending){reloadPending=false;void load();}}}
 function hidden(){if(!document.hidden){if(!gps.orderId)attemptedOrder=null;void load();}}
 const pagehide=()=>{gps.stop();attemptedOrder=null;};
 const permissionChanged=()=>{attemptedOrder=null;if(permission?.state==='denied')gps.stop('Location permission is blocked. Allow location in your browser settings.');else if(permission?.state==='granted')void load();};
 navigator.permissions?.query({name:'geolocation'}).then(p=>{permission=p;p.addEventListener('change',permissionChanged);if(p.state==='denied')permissionChanged();}).catch(()=>{});
 const initialMap=root.querySelector('#driver-map');if(initialMap&&renderLocation&&token)initialMap.append(renderLocation(null));
 root.querySelector('#refresh').onclick=load;display();if(token)void load();
 const refreshTimer=setInterval(()=>{if(!api.watch&&token&&!document.hidden)void load();},10000);
 document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',pagehide);
 return {refresh:load,destroy(){clearInterval(refreshTimer);unwatch?.();gps.destroy();renderLocation?.destroy?.();permission?.removeEventListener('change',permissionChanged);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',pagehide);}};
}
