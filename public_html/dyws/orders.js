import {markReady,traceLoad} from './diagnostics.js';
import {redirectToAuth} from './admin-session.js?v=38';
import {mountOrderList} from './order-list.js?v=38';
import {formatTime,formatDateTime} from './date-time.js';
import {pluginSlot} from './plugin-ui.js?v=38';
import {money as formatMoney,escapeHTML as esc,statusText} from './api.js';
import {defaultRole} from './role-labels.js';
export function mountOrders({root=document,api,role=defaultRole,storageKey='dyws-manager',renderLocation,plugins}) {
 if(typeof api!=='function')throw new TypeError('A DYWS API client is required.');
let token=sessionStorage.getItem(storageKey),busy=false,loading=false,loadAgain=false,unwatch=null,watchedToken=null,orders=[];
const mapPanel=document.createElement('section');mapPanel.hidden=true;mapPanel.innerHTML='<h2>Deliveries</h2><label>Order <select class="dyws-map-order"></select></label><p class="dyws-map-message"></p><div class="dyws-manager-map"></div>';root.querySelector('#orders').parentElement.after(mapPanel);
const mapOrder=mapPanel.querySelector('select'),mapMessage=mapPanel.querySelector('.dyws-map-message'),mapContainer=mapPanel.querySelector('.dyws-manager-map');
function updateMap(){mapPanel.hidden=!orders.length;if(!orders.length){renderLocation?.clear?.();return;}const order=orders.find(o=>o.id===mapOrder.value),gps=order?.gps;mapMessage.textContent=gps?.location?(gps.source==='simulated'?'Simulated GPS test':'Device GPS')+' · '+formatTime(gps.recordedAt):order?'Waiting for a GPS fix.':'No deliveries on the way.';const node=renderLocation?.(gps?.location||null,role,{destinationAddress:order?.address});if(node&&!mapContainer.contains(node))mapContainer.replaceChildren(node);}
mapOrder.onchange=()=>{renderLocation?.clear?.();updateMap();};
const error=root.querySelector('#error');
const orderList=mountOrderList({root:root.querySelector('#orders'),plugins,renderOrder});
function display(){if(!token){renderLocation?.clear?.();orders=[];void orderList.clear();redirectToAuth(root);return;}if(token!==watchedToken){unwatch?.();watchedToken=token;unwatch=token?api.watch?.({scope:'operator',token,interval:10000},()=>{if(!busy)return load();}):null;}root.querySelector('#dashboard').hidden=!token;root.querySelector('#logout').hidden=!token;}
root.querySelector('#logout').onclick=async()=>{try{await api('/logout',{method:'POST',body:{},token});}catch{}token=null;sessionStorage.removeItem(storageKey);display();};
const statuses={placed:['accepted','cancelled'],accepted:['preparing','cancelled'],preparing:['ready','cancelled'],ready:['completed','out_for_delivery','cancelled'],out_for_delivery:['delivered']};
async function mutate(route,body){if(busy)return;busy=true;root.querySelectorAll('#orders [data-order-content] button').forEach(b=>b.disabled=true);try{await api(route,{method:'POST',body,token});await load();}catch(e){error.textContent=e.message;}finally{busy=false;root.querySelectorAll('#orders [data-order-content] button').forEach(b=>b.disabled=false);}}

function renderOrder(o,data,container){
  const money=n=>formatMoney(n,o.currency);
  const next=(statuses[o.status]||[]).filter(s=>!(s==='completed'&&o.fulfillment!=='pickup')&&!(s==='out_for_delivery'&&o.fulfillment!=='delivery'));
  container.innerHTML=`<article data-order="${o.id}"><h3>${o.id} · ${money(o.total)}</h3><p>${esc(statusText(o.status))} · ${esc(o.fulfillment)} · payment ${esc(o.payment_status)}</p><p>${esc(o.customer_name)} · ${esc(o.customer_phone)}<br>${esc(o.address)}</p><ul>${o.lines.map(l=>`<li>${l.quantity} × ${esc(l.name)} ${esc(l.option)} · ${money(l.price*l.quantity)}</li>`).join('')}</ul>${o.notes?`<p>Notes: ${esc(o.notes)}</p>`:''}<p><small>${formatDateTime(o.created_at)} · ${esc(role.singular)}: ${esc(o.driver_id||'Not assigned')}</small></p><div class="dyws-order-gps"></div><div class="dyws-actions">${next.map(s=>`<button data-status="${s}">${esc(statusText(s))}</button>`).join('')}${o.payment_provider==='demo'&&o.payment_status==='unpaid'&&o.status!=='cancelled'?'<button data-payment="capture">Record test payment</button>':''}${o.payment_provider==='demo'&&o.payment_status==='paid'?'<button data-payment="refund">Record full test refund</button>':''}</div>${o.payment_provider!=='demo'?'<p>Online test payment. Manage refunds with the payment provider.</p>':''}${o.fulfillment==='delivery'&&!['out_for_delivery','delivered','cancelled'].includes(o.status)?`<label>${esc(role.singular)} <select class="dyws-driver-select">${data.drivers.map(d=>`<option value="${esc(d.id)}" ${d.id===o.driver_id?'selected':''}>${esc(d.name)}</option>`).join('')}</select></label><button data-assign>Assign ${esc(role.singular)}</button>`:''}</article>`;

 container.querySelectorAll('article[data-order]').forEach(card=>{
  const gps=data.orders.find(o=>o.id===card.dataset.order)?.gps,block=card.querySelector('.dyws-order-gps');
  if(gps?.sharing){const label=document.createElement('p');label.textContent=(gps.source==='simulated'?'Simulated GPS test':'Device GPS')+' · '+(gps.recordedAt?(gps.stale?'Last known position':'Location received')+' · '+formatTime(gps.recordedAt)+' · accuracy '+Math.round(gps.accuracy)+' m':'Waiting for a location fix');block.append(label);if(gps.location){const coordinates=document.createElement('p');coordinates.textContent=gps.location.latitude.toFixed(5)+', '+gps.location.longitude.toFixed(5);block.append(coordinates);}}
  else if(data.orders.find(o=>o.id===card.dataset.order)?.fulfillment==='delivery')block.textContent='GPS is off.';
 });
 container.querySelectorAll('article[data-order]').forEach(card=>{const base='/manager/orders/'+card.dataset.order;card.querySelectorAll('[data-status]').forEach(b=>b.onclick=()=>mutate(base+'/status',{status:b.dataset.status}));card.querySelectorAll('[data-payment]').forEach(b=>b.onclick=()=>mutate(base+'/payment',{kind:b.dataset.payment}));card.querySelector('[data-assign]')?.addEventListener('click',()=>mutate(base+'/assign',{driverId:card.querySelector('select').value}));});

 const card=container.querySelector('article');if(plugins&&card)void plugins.runAction('admin:order',{root:pluginSlot(card,'order'),order:o});
}
async function load(){if(!token)return;if(loading){loadAgain=true;return;}loading=true;try{
 const data=await api('/manager/orders',{token});error.textContent='';
 await traceLoad('Orders render',()=>orderList.update(data,{force:busy}));markReady();
 orders=data.orders.filter(o=>o.status==='out_for_delivery');const selected=mapOrder.value;mapOrder.innerHTML=orders.map(o=>`<option value="${o.id}">${o.id} · ${esc(o.driver_id||role.singular)}</option>`).join('');if(orders.some(o=>o.id===selected))mapOrder.value=selected;mapOrder.disabled=!orders.length;updateMap();
 root.querySelectorAll('#orders [data-order-content] button').forEach(b=>b.disabled=busy);
 }catch(e){if(e.status===401){token=null;sessionStorage.removeItem(storageKey);display();}error.textContent=e.message;}finally{loading=false;if(loadAgain){loadAgain=false;queueMicrotask(load);}}}
root.querySelector('#refresh').onclick=load;
display();if(token)load();const refreshTimer=setInterval(()=>{if(!api.watch&&token&&!document.hidden&&!busy&&!root.querySelector('#orders')?.contains(document.activeElement))load();},10000);

return {refresh:load,destroy(){void orderList.destroy();renderLocation?.clear?.();clearInterval(refreshTimer);unwatch?.();}};

}
