import {escapeHTML as esc} from './api.js';
import {driverReportReasons} from './customer-account.js';
import {formatDateTime} from './date-time.js';
export function mountCustomerReports({root,api,getToken}){
 root.innerHTML='<details><summary>Customer driver reports</summary><button type="button" data-refresh>Refresh reports</button><div data-reports></div><button type="button" data-more hidden>More reports</button><p role="status"></p></details>';
 let loading=false,next=null;
 async function load(offset=0){
  if(loading)return;loading=true;root.querySelectorAll('button').forEach(b=>b.disabled=true);
  try{
   const data=await api('/manager/customer-reports?offset='+offset,{token:getToken()});
   const html=data.reports.map(r=>`<article><h3>${esc(r.order_id)} · ${esc(r.driverName||r.driver_id)}</h3><p>${esc(driverReportReasons[r.reason]||r.reason)} · ${esc(formatDateTime(r.created_at))}</p><p>${esc(r.details)}</p><p>${r.driverBlocked?'Blocked by this customer account. Do not assign this driver to their deliveries.':'No active block for this driver and customer account.'}</p></article>`).join('');
   const box=root.querySelector('[data-reports]');if(offset)box.insertAdjacentHTML('beforeend',html);else box.innerHTML=html||'<p>No customer driver reports.</p>';
   next=data.nextOffset;root.querySelector('[data-more]').hidden=next===null;root.querySelector('[role="status"]').textContent='';
  }catch(e){root.querySelector('[role="status"]').textContent=e.message;}finally{loading=false;root.querySelectorAll('button').forEach(b=>b.disabled=false);}
 }
 root.querySelector('details').addEventListener('toggle',e=>{if(e.target.open)void load();});
 root.querySelector('[data-refresh]').onclick=()=>void load();root.querySelector('[data-more]').onclick=()=>void load(next);
}
