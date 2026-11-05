import {money,escapeHTML as esc} from './api.js';
import {reportsPreviewHTML} from './reports-preview.js';
import {dateKey} from './date-time.js';

/** Host styled reports panel. A preview switch can only remove access, never grant it. */
export function mountReportPanel({root,request,onError=()=>{},allowFreePreview=false}){
 let version=0,disposed=false,entitlements=null,preview=false;
 async function open(){const read=++version;try{const access=await request('/manager/entitlements');if(disposed||read!==version)return;entitlements=access;render();}catch(error){if(!disposed&&read===version)onError(error);}}
 function render(){
  if(preview||!entitlements.capabilities.reports){root.innerHTML=(preview?'<button type="button" data-report-return>Back to Pro reports</button>':'')+reportsPreviewHTML();root.querySelector('[data-report-return]')?.addEventListener('click',()=>{preview=false;render();});return;}
  const to=dateKey(),from=new Date(to+'T12:00:00Z');from.setUTCDate(from.getUTCDate()-29);
  root.innerHTML=`<h2>Reports <small>Pro</small></h2>${allowFreePreview?'<button type="button" data-report-preview>View Free tier preview</button>':''}<form data-report-query><label>From <input name="from" type="date" value="${from.toISOString().slice(0,10)}" required></label><label>To <input name="to" type="date" value="${to}" required></label><button>Refresh reports</button></form><p role="status" data-report-status></p><div data-report-result></div>`;
  root.querySelector('[data-report-preview]')?.addEventListener('click',()=>{version++;preview=true;render();});
  const form=root.querySelector('form');form.onsubmit=event=>{event.preventDefault();void load(form);};void load(form);
 }
 async function load(form){const read=++version,button=form.querySelector('button');button.disabled=true;try{
  const params=new URLSearchParams({from:form.elements.from.value,to:form.elements.to.value});
  const report=await request('/manager/reports?'+params);if(disposed||read!==version)return;
  root.querySelector('[data-report-result]').innerHTML=`<h3>Overview</h3><dl>${[['Orders',report.orderCount],['Active orders',report.activeOrders],['Cancelled',report.cancelledOrders],...['orderedValue','captured','refunded','netCollected','netSales','netDeliveryFees','netTax','netTips'].map((key,i)=>[['Ordered value','Payments','Refunds','Net payments','Product sales before tax','Net delivery fees','Net tax','Net tips'][i],money(report[key],report.currency)])].map(([name,value])=>`<div><dt>${name}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl><h3>Popular items</h3>${report.topItems.length?`<table><thead><tr><th>Item</th><th>Quantity</th><th>Ordered subtotal</th></tr></thead><tbody>${report.topItems.map(item=>`<tr><td>${esc(item.name)} ${esc(item.option)}</td><td>${item.quantity}</td><td>${money(item.orderedSubtotal,report.currency)}</td></tr>`).join('')}</tbody></table>`:'<p>No items in this date range.</p>'}`;
 }catch(error){if(disposed||read!==version)return;if(error.code==='pro_required'){entitlements={tier:'free',capabilities:{reports:false}};preview=false;render();}else onError(error);}finally{if(button.isConnected)button.disabled=false;}}
 return {open,cancel(){version++;},destroy(){version++;disposed=true;}};
}
