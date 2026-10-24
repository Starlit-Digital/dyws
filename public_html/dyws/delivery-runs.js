import {statusBadge} from './status-badge.js';
import {escapeHTML as esc} from './api.js';
/** Keep the dispatch draft in memory so background updates never replace an edit. */
export function mountDeliveryRuns({root,api,getToken,onSaved,onError,role}) {
 let data={orders:[],drivers:[],runs:[]},selected=[],driver='',requestKey=null,busy=false;
 root.innerHTML=`<details><summary>Delivery runs</summary><div class="dyws-run-list"></div><form class="dyws-run-form"><h3>New run</h3><label>${esc(role.singular)} <select name="driver" required></select></label><label>Add a ready delivery <select name="order"><option value="">Choose an order</option></select></label><button type="button" class="dyws-secondary" data-add>Add stop</button><ol class="dyws-run-draft"></ol><p class="dyws-note">Stops are visited in this order. Payment must be confirmed before departure.</p><button type="submit">Create run</button></form></details>`;
 const form=root.querySelector('form'),driverSelect=form.elements.driver,orderSelect=form.elements.order,list=root.querySelector('.dyws-run-list'),draft=root.querySelector('.dyws-run-draft');
 const available=()=>data.orders.filter(o=>o.fulfillment==='delivery'&&o.status==='ready'&&!o.deliveryRun&&(!o.driver_id||o.driver_id===driver));
 const label=o=>o?`${o.id} · ${o.customer_name} · ${o.address}`:'Unavailable order';
 function choices(){const previous=orderSelect.value;orderSelect.innerHTML='<option value="">Choose an order</option>'+available().filter(o=>!selected.includes(o.id)).map(o=>`<option value="${o.id}">${esc(label(o))}</option>`).join('');orderSelect.value=previous;}
 function renderDraft(){draft.innerHTML=selected.map((id,i)=>`<li><span>${esc(label(data.orders.find(o=>o.id===id)))}</span><div class="dyws-actions"><button type="button" class="dyws-secondary" data-move="${i}" ${i===0?'disabled':''} aria-label="Move stop ${i+1} earlier">↑</button><button type="button" class="dyws-secondary" data-remove="${i}" aria-label="Remove stop ${i+1}">Remove</button></div></li>`).join('');choices();}
 function changed(){requestKey=null;renderDraft();}
 driverSelect.onchange=()=>{driver=driverSelect.value;changed();};
 root.querySelector('[data-add]').onclick=()=>{if(!busy&&orderSelect.value&&!selected.includes(orderSelect.value)){selected.push(orderSelect.value);changed();}};
 draft.onclick=e=>{const b=e.target.closest('button');if(!b||busy)return;if(b.dataset.remove!==undefined)selected.splice(Number(b.dataset.remove),1);else if(b.dataset.move!==undefined){const i=Number(b.dataset.move);if(i>0)[selected[i-1],selected[i]]=[selected[i],selected[i-1]];}changed();};
 async function save(route,body,created=false){if(busy)return;busy=true;root.querySelectorAll('button,select').forEach(n=>n.disabled=true);try{await api(route,{method:'POST',token:getToken(),body});if(created){selected=[];requestKey=null;renderDraft();}await onSaved();}catch(e){onError(e.message);}finally{busy=false;update(data);root.querySelectorAll('.dyws-run-form button,select').forEach(n=>n.disabled=false);renderDraft();}}
 form.onsubmit=e=>{e.preventDefault();if(!selected.length){onError('Add at least one ready delivery.');return;}requestKey??=crypto.randomUUID();void save('/manager/runs',{driverId:driver,orderIds:selected,idempotencyKey:requestKey},true);};
 list.onclick=e=>{const b=e.target.closest('button[data-run]');if(!b||busy)return;const run=data.runs.find(r=>r.id===b.dataset.run);if(!run)return;const body={revision:Number(run.revision),action:b.dataset.action};if(body.action==='reorder'){body.orderIds=[...run.orderIds];const i=Number(b.dataset.position);[body.orderIds[i-1],body.orderIds[i]]=[body.orderIds[i],body.orderIds[i-1]];}void save('/manager/runs/'+run.id,body);};
 function update(next){data={...next,runs:next.runs||[]};
  const drivers=data.drivers.map(d=>`<option value="${esc(d.id)}">${esc(d.name)}</option>`).join('');if(driverSelect.innerHTML!==drivers){driverSelect.innerHTML=drivers;if(driver)driverSelect.value=driver;else driver=driverSelect.value;}
  choices(); // Leave the selected draft, its ordering and its request key alone.
  list.innerHTML=data.runs.map(run=>`<article><h3>${esc(data.drivers.find(d=>d.id===run.driver_id)?.name||run.driver_id)}</h3><p>${statusBadge(run.status==='active'?'out_for_delivery':'planned')}</p><p class="dyws-note">${run.id}</p><ol>${run.stops.map((stop,i)=>`<li><span>${stop.status==='delivered'?'✓ ':''}${esc(stop.customerName)} · ${esc(stop.address)}</span>${run.status==='planned'&&i>0?`<button type="button" class="dyws-secondary" data-run="${run.id}" data-action="reorder" data-position="${i}" aria-label="Move stop ${i+1} earlier">↑</button>`:''}</li>`).join('')}</ol>${run.status==='planned'?`<button type="button" class="dyws-secondary" data-run="${run.id}" data-action="cancel">Cancel run</button>`:''}</article>`).join('')||'<p>No open runs.</p>';
  if(busy)root.querySelectorAll('button,select').forEach(n=>n.disabled=true);
 }
 return {update};
}
