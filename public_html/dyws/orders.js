import {statusBadge} from './status-badge.js';
import {mountDeliveryRuns} from './delivery-runs.js';
import {markReady,traceLoad} from './diagnostics.js';
import {redirectToAuth} from './admin-session.js?v=39';
import {mountOrderList} from './order-list.js?v=40';
import {formatTime,formatDateTime} from './date-time.js';
import {pluginSlot} from './plugin-ui.js?v=39';
import {money as formatMoney,escapeHTML as esc,statusText} from './api.js';
import {defaultRole} from './role-labels.js';
export function mountOrders({root=document,api,role=defaultRole,storageKey='dyws-manager',renderLocation,plugins}) {
 if(typeof api!=='function')throw new TypeError('A DYWS API client is required.');
let token=sessionStorage.getItem(storageKey),busy=false,loading=false,loadAgain=false,unwatch=null,watchedToken=null,orders=[],drivers=[];
const mapPanel=document.createElement('section');mapPanel.hidden=true;mapPanel.innerHTML='<h2>Deliveries</h2><label>Order <select class="dyws-map-order"></select></label><p class="dyws-map-message"></p><div class="dyws-manager-map"></div>';root.querySelector('#orders').parentElement.after(mapPanel);
const mapOrder=mapPanel.querySelector('select'),mapMessage=mapPanel.querySelector('.dyws-map-message'),mapContainer=mapPanel.querySelector('.dyws-manager-map');
function updateMap(){mapPanel.hidden=!orders.length;if(!orders.length){renderLocation?.clear?.();return;}const order=orders.find(o=>o.id===mapOrder.value),gps=order?.gps;mapMessage.textContent=gps?.location?(gps.source==='simulated'?'Simulated GPS':'Device GPS')+' · '+formatTime(gps.recordedAt):order?'Waiting for a GPS fix.':'No deliveries on the way.';const node=renderLocation?.(gps?.location||null,role,{destinationAddress:order?.address,profileIcon:drivers.find(driver=>driver.id===order?.driver_id)?.profileIcon});if(node&&!mapContainer.contains(node))mapContainer.replaceChildren(node);}
mapOrder.onchange=()=>{renderLocation?.clear?.();updateMap();};
const error=root.querySelector('#error');
const runRoot=root.querySelector('#delivery-runs');
const runs=runRoot?mountDeliveryRuns({root:runRoot,api,getToken:()=>token,onSaved:load,onError:message=>{error.textContent=message;},role}):null;
const orderList=mountOrderList({root:root.querySelector('#orders'),plugins,renderOrder});
function display(){if(!token){renderLocation?.clear?.();orders=[];void orderList.clear();redirectToAuth(root);return;}if(token!==watchedToken){unwatch?.();watchedToken=token;unwatch=token?api.watch?.({scope:'operator',token,interval:10000},()=>{if(!busy)return load();}):null;}root.querySelector('#dashboard').hidden=!token;root.querySelector('#logout').hidden=!token;}
root.querySelector('#logout').onclick=async()=>{try{await api('/logout',{method:'POST',body:{},token});}catch{}token=null;sessionStorage.removeItem(storageKey);display();};
const statuses={placed:['accepted','cancelled'],accepted:['preparing','cancelled'],preparing:['ready','cancelled'],ready:['completed','out_for_delivery','cancelled'],out_for_delivery:['delivered']};
async function mutate(route,body){if(busy)return;busy=true;root.querySelectorAll('#orders [data-order-content] button').forEach(b=>b.disabled=true);try{await api(route,{method:'POST',body,token});await load();}catch(e){error.textContent=e.message;}finally{busy=false;root.querySelectorAll('#orders [data-order-content] button').forEach(b=>b.disabled=false);if(loadAgain){loadAgain=false;void load();}}}

function renderOrder(o,data,container){
  const money=n=>formatMoney(n,o.currency);
  const next=(o.deliveryRun?[]:statuses[o.status]||[]).filter(s=>!(s==='completed'&&o.fulfillment!=='pickup')&&!(s==='out_for_delivery'&&o.fulfillment!=='delivery'));
  container.innerHTML=`<article data-order="${o.id}"><h3 class="dyws-order-heading"><span>${o.id}</span><span class="dyws-order-total">${money(o.total)}</span></h3><p class="dyws-status-row">${statusBadge(o.status)}${statusBadge(o.fulfillment)}${statusBadge(o.payment_status)}</p>${o.orderLocation?`<p><strong>Location: ${esc(o.orderLocation.name)}</strong><br>${esc(o.orderLocation.address)}</p>`:''}<div class="dyws-order-customer"><p class="dyws-order-label">Customer</p><p class="dyws-order-name">${esc(o.customer_name)}</p><p>${esc(o.customer_phone)}</p>${o.address?`<p>${esc(o.address)}</p>`:''}</div><ul class="dyws-order-items">${o.lines.map(l=>`<li><span>${l.quantity} × ${esc(l.name)} ${esc(l.option)}</span><strong>${money(l.price*l.quantity)}</strong></li>`).join('')}</ul>${o.notes?`<p>Notes: ${esc(o.notes)}</p>`:''}${o.deliveryRun?`<p>Run ${esc(o.deliveryRun.id)} · Stop ${o.deliveryRun.position}</p>`:''}<p><small>${formatDateTime(o.created_at)} · ${esc(role.singular)}: ${esc(o.driver_id||'Not assigned')}</small></p><div class="dyws-order-gps"></div><div class="dyws-actions">${next.map(s=>`<button data-status="${s}">${esc(statusText(s))}</button>`).join('')}${o.payment_provider==='demo'&&o.payment_status==='unpaid'&&o.status!=='cancelled'?'<button data-payment="capture">Record payment</button>':''}${o.payment_provider==='demo'&&o.payment_status==='paid'?'<button data-payment="refund">Record full refund</button>':''}</div>${o.payment_provider!=='demo'?'<p>Online payment. Manage refunds with the payment provider.</p>':''}${!o.deliveryRun&&o.fulfillment==='delivery'&&!['out_for_delivery','delivered','cancelled'].includes(o.status)?`<label>${esc(role.singular)} <select class="dyws-driver-select">${data.drivers.map(d=>`<option value="${esc(d.id)}" ${d.id===o.driver_id?'selected':''}>${esc(d.name)}</option>`).join('')}</select></label><button data-assign>Assign ${esc(role.singular)}</button>`:''}</article>`;

 container.querySelectorAll('article[data-order]').forEach(card=>{
  const gps=data.orders.find(o=>o.id===card.dataset.order)?.gps,block=card.querySelector('.dyws-order-gps');
  if(gps?.sharing){const label=document.createElement('p');label.textContent=(gps.source==='simulated'?'Simulated GPS':'Device GPS')+' · '+(gps.recordedAt?(gps.stale?'Last known position':'Location received')+' · '+formatTime(gps.recordedAt)+' · accuracy '+Math.round(gps.accuracy)+' m':'Waiting for a location fix');block.append(label);if(gps.location){const coordinates=document.createElement('p');coordinates.textContent=gps.location.latitude.toFixed(5)+', '+gps.location.longitude.toFixed(5);block.append(coordinates);}}
  else if(data.orders.find(o=>o.id===card.dataset.order)?.fulfillment==='delivery')block.textContent='GPS is off.';
 });
 container.querySelectorAll('article[data-order]').forEach(card=>{const base='/manager/orders/'+card.dataset.order;card.querySelectorAll('[data-status]').forEach(b=>b.onclick=()=>mutate(base+'/status',{status:b.dataset.status}));card.querySelectorAll('[data-payment]').forEach(b=>b.onclick=()=>mutate(base+'/payment',{kind:b.dataset.payment}));card.querySelector('[data-assign]')?.addEventListener('click',()=>mutate(base+'/assign',{driverId:card.querySelector('select').value}));});

 const card=container.querySelector('article');if(plugins&&card)void plugins.runAction('admin:order',{root:pluginSlot(card,'order'),order:o});
}
async function load(){if(!token)return;if(loading){loadAgain=true;return;}loading=true;try{
 const data=await api('/manager/orders',{token});error.textContent='';
 drivers=data.drivers||[];runs?.update(data);
 await traceLoad('Orders render',()=>orderList.update(data,{force:busy}));markReady();
 orders=data.orders.filter(o=>o.status==='out_for_delivery');const selected=mapOrder.value;mapOrder.innerHTML=orders.map(o=>`<option value="${o.id}">${o.id} · ${esc(o.driver_id||role.singular)}</option>`).join('');if(orders.some(o=>o.id===selected))mapOrder.value=selected;mapOrder.disabled=!orders.length;updateMap();
 root.querySelectorAll('#orders [data-order-content] button').forEach(b=>b.disabled=busy);
 }catch(e){if(e.status===401){token=null;sessionStorage.removeItem(storageKey);display();}error.textContent=e.message;}finally{loading=false;if(loadAgain){loadAgain=false;queueMicrotask(load);}}}
root.querySelector('#refresh').onclick=load;
display();if(token)load();const refreshTimer=setInterval(()=>{if(!api.watch&&token&&!document.hidden&&!busy&&!root.querySelector('#orders')?.contains(document.activeElement))load();},10000);
function resume(){if(document.hidden||!token)return;if(busy){loadAgain=true;return;}void load();}
document.addEventListener('visibilitychange',resume);window.addEventListener('focus',resume);window.addEventListener('online',resume);

return {refresh:load,destroy(){void orderList.destroy();renderLocation?.clear?.();clearInterval(refreshTimer);unwatch?.();document.removeEventListener('visibilitychange',resume);window.removeEventListener('focus',resume);window.removeEventListener('online',resume);}};

}
