import {dateKey} from './date-time.js';
import {pluginSlot} from './plugin-ui.js?v=35';
import {money as formatMoney,escapeHTML as esc} from './api.js';
import {defaultRole} from './role-labels.js';
export function mountManager({root=document,api,role=defaultRole,storageKey='dyws-manager',loginPage,plugins}) {
 if(typeof api!=='function')throw new TypeError('A DYWS API client is required.');
let token=sessionStorage.getItem(storageKey),report,loading=false,loadAgain=false,unwatch=null,watchedToken=null;
const money=n=>formatMoney(n,report?.currency||'CAD');
const error=root.querySelector('#error');
const day=dateKey();const first=new Date(day+'T12:00:00Z');first.setUTCDate(first.getUTCDate()-29);root.querySelector('#from').value=first.toISOString().slice(0,10);root.querySelector('#to').value=day;
function display(){if(!token&&loginPage){location.replace(loginPage);return;}if(token!==watchedToken){unwatch?.();watchedToken=token;unwatch=token?api.watch?.({scope:'operator',token,interval:10000},load):null;}root.querySelector('#login').hidden=!!token;root.querySelector('#dashboard').hidden=!token;root.querySelector('#logout').hidden=!token;}
root.querySelector('#login-form').onsubmit=async e=>{e.preventDefault();try{const data=await api('/login',{method:'POST',body:{role:'manager',password:new FormData(e.target).get('password')}});token=data.token;sessionStorage.setItem(storageKey,token);e.target.reset();display();await load();}catch(e){error.textContent=e.message;}};
root.querySelector('#logout').onclick=async()=>{try{await api('/logout',{method:'POST',body:{},token});}catch{}token=null;sessionStorage.removeItem(storageKey);display();};
async function load(){if(!token)return;if(loading){loadAgain=true;return;}loading=true;try{
 let query={from:root.querySelector('#from').value,to:root.querySelector('#to').value};if(plugins)query=await plugins.applyFilters('reports:query',query);const params=new URLSearchParams(query);
 const r=await api(`/manager/reports?${params}`,{token});report=r;error.textContent='';
 const stats=[['Orders',r.orderCount],['Active orders',r.activeOrders],['Cancelled',r.cancelledOrders],['Ordered value',money(r.orderedValue)],['Average order',money(r.averageOrderValue)],['Test payments',money(r.captured)],['Test refunds',money(r.refunded)],['Net test payments',money(r.netCollected)],['Product sales before tax',money(r.netSales)],['Net delivery fees',money(r.netDeliveryFees)],['Net tax',money(r.netTax)],['Average preparation',r.averagePreparationSeconds===null?'No data':Math.round(r.averagePreparationSeconds/60)+' min'],['Average delivery',r.averageDeliverySeconds===null?'No data':Math.round(r.averageDeliverySeconds/60)+' min']];
 root.querySelector('#stats').innerHTML=stats.map(([name,value])=>`<div class="dyws-stat">${esc(name)}<strong>${esc(value)}</strong></div>`).join('');
 root.querySelector('#top-items').innerHTML='<table><thead><tr><th>Item</th><th>Quantity</th><th>Ordered subtotal</th></tr></thead><tbody>'+r.topItems.map(i=>`<tr><td>${esc(i.name)} ${esc(i.option)}</td><td>${i.quantity}</td><td>${money(i.orderedSubtotal)}</td></tr>`).join('')+'</tbody></table>';
 const reportRoot=root.querySelector('#report-plugin');if(reportRoot){const rendered=await plugins?.renderReports?.({root:reportRoot,report:r});reportRoot.hidden=!rendered;root.querySelectorAll('[data-report-fallback]').forEach(n=>n.hidden=!!rendered);}
 if(plugins){
  void plugins.runAction('admin:dashboard',{root:pluginSlot(root.querySelector('#dashboard'),'dashboard'),report:r});
 }
 }catch(e){if(e.status===401){token=null;sessionStorage.removeItem(storageKey);display();}error.textContent=e.message;}finally{loading=false;if(loadAgain){loadAgain=false;queueMicrotask(load);}}}
root.querySelector('#refresh').onclick=load;
root.querySelector('#export').onclick=async()=>{if(!report)return;const fields=['orderCount','activeOrders','cancelledOrders','orderedValue','captured','refunded','netCollected','netSales','netDeliveryFees','netTax','averageOrderValue'];const rows=['metric,value,currency,units',...fields.map(k=>`${k},${report[k]},${report.currency},${k.includes('Orders')||k==='orderCount'?'count':'cents'}`)];const exported=plugins?await plugins.applyFilters('reports:export',rows.map(row=>row.split(',')),{key:'summary',report}):rows.map(row=>row.split(','));const csv=exported.map(row=>row.map(value=>'\"'+(typeof value==='string'?value.replace(/^[\s]*[=+@\-]/,"'$&"):String(value??'')).replaceAll('\"','\"\"')+'\"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download='dyws-report.csv';a.click();URL.revokeObjectURL(url);};
void plugins?.runAction('admin:report-controls',{root:root.querySelector('.dyws-toolbar'),refresh:load});
display();if(token)load();const refreshTimer=setInterval(()=>{if(!api.watch&&token&&!document.hidden)load();},10000);

return {refresh:load,destroy(){clearInterval(refreshTimer);unwatch?.();}};

}
