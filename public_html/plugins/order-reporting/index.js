import {dateKey} from '../../dyws/date-time.js';
import {escapeHTML as esc,money,statusText} from '../../dyws/api.js';
import {chartSVG,csvText,comparison,download} from './charts.js';
export function register(plugin) {
 let currency,fulfillment;
 plugin.addAction('admin:report-controls',({root,refresh})=>{
  const box=root.ownerDocument.createElement('div');box.className='dyws-report-controls';
  box.innerHTML='<label>Period <select data-period><option value="30">Last 30 days</option><option value="7">Last 7 days</option><option value="1">Today</option><option value="month">This month</option><option value="custom">Custom dates</option></select></label><label>Currency <select data-currency><option value="">Store currency</option></select></label><label>Fulfilment <select data-fulfillment><option value="all">All orders</option><option value="pickup">Pickup</option><option value="delivery">Delivery</option></select></label>';
  root.prepend(box);currency=box.querySelector('[data-currency]');fulfillment=box.querySelector('[data-fulfillment]');
  const period=box.querySelector('[data-period]'),from=root.querySelector('#from'),to=root.querySelector('#to');
  from.addEventListener('change',()=>period.value='custom');to.addEventListener('change',()=>period.value='custom');
  period.onchange=()=>{if(period.value==='custom')return;const today=dateKey();to.value=today;const d=new Date(today+'T12:00:00Z');if(period.value==='month')d.setUTCDate(1);else d.setUTCDate(d.getUTCDate()-Number(period.value)+1);from.value=d.toISOString().slice(0,10);refresh();};
  currency.onchange=fulfillment.onchange=refresh;
 });
 plugin.addFilter('reports:query',query=>({...query,...(currency?.value?{currency:currency.value}:{}),fulfillment:fulfillment?.value||'all'}));
 plugin.addFilter('reports:export',(rows,{key,report})=>{
  if(key==='summary'&&report.orderReportingError)return [['Error',report.orderReportingError]];
  const data=report.orderReporting;if(key!=='summary'||!data)return rows;
  const counts=new Set(['orders','active','completed','cancelled','unpaidOrders','preparationSamples','deliverySamples']);
  return [['Metric','Value','Currency','Units','From','To','Fulfilment','Timezone'],...Object.entries(data.current.summary).map(([name,value])=>[name,value,data.currency,counts.has(name)?'count':name.endsWith('Rate')?'percent':name.endsWith('Seconds')?'seconds':'cents',data.range.from,data.range.to,data.fulfillment,data.timeZone])];
 });
 const states=new WeakMap();
 plugin.provide('reports.renderer',async({root,report,applyFilters,runAction})=>{
  if(report.orderReportingError){await runAction('admin:tables',{root,phase:'dispose'});states.delete(root);root.textContent=report.orderReportingError;return true;}
  const data=report.orderReporting;if(!data)return false;
  if(currency){const chosen=currency.value;currency.innerHTML=data.currencies.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');currency.value=data.currencies.includes(chosen)?chosen:data.currency;}
  const signature=JSON.stringify(data),old=states.get(root);if(old===signature)return true;
  // Keep focused searches and open table disclosures stable between live refreshes.
  if(root.contains(root.ownerDocument.activeElement)&&old)return true;
  const open=[...root.querySelectorAll('details[open]')].map(n=>n.dataset.detail);
  await runAction('admin:tables',{root,phase:'dispose'});
  const r=data.current,s=r.summary,p=data.previous,fmt=v=>money(v,data.currency),minutes=v=>v===null?'No data':`${Math.round(v/60)} min`;
  let cards=[{label:'Net test payments',value:fmt(s.netCollected),detail:comparison(s.netCollected,p.netCollected,fmt)},{label:'Orders',value:s.orders,detail:comparison(s.orders,p.orders)},{label:'Average order',value:fmt(s.averageOrder),detail:comparison(s.averageOrder,p.averageOrder,fmt)},{label:'Completed',value:s.completionRate===null?'No data':s.completionRate+'%',detail:`${s.completed} of ${s.orders} orders`}];
  cards=await applyFilters('reports:cards',cards,{report:data});
  const table=(id,headers,rows)=>`<div class="dyws-table-wrap" tabindex="0" role="region" aria-label="${esc(id)}"><table data-dyws-report-table data-table-key="${esc(id)}"><caption>${esc(id)}</caption><thead><tr>${headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>'<tr>'+row.map(cell=>{const value=cell?.value??cell,sort=cell?.sort;return `<td${sort!==undefined?` data-order="${esc(sort)}"`:''}>${esc(value)}</td>`;}).join('')+'</tr>').join('')}</tbody></table></div>`;
  const amounts=n=>({value:fmt(n),sort:n});
  const dailyRows=r.daily.map(d=>[d.date,d.orders,amounts(d.orderedValue),amounts(d.captured),amounts(d.refunded),amounts(d.netCollected)]);
  const dailyHeaders=['Day','Orders',`Ordered (${data.currency})`,'Test payments','Test refunds','Net test payments'];
  const itemRows=r.items.map(i=>[i.name+(i.option?' · '+i.option:''),i.quantity,amounts(i.orderedSubtotal)]);
  const graph=(key,title,bars)=>`<section class="dyws-report-chart"><div class="dyws-report-heading"><h2>${esc(title)}</h2><button type="button" class="dyws-secondary" data-svg="${key}" aria-label="Download ${esc(title)} as SVG">SVG</button></div>${chartSVG(r.daily,{title:title+' · '+data.currency,key,label:'date',format:key==='orders'?v=>String(Math.round(v)):v=>fmt(Math.round(v)),bars})}</section>`;
  const maxStatus=Math.max(1,...r.statuses.map(row=>row.count));
  root.innerHTML=`<div class="dyws-report"><p class="dyws-report-caption">${esc(data.range.from)} to ${esc(data.range.to)} · ${esc(data.currency)} · ${esc(data.timeZone)}<br><small>Compared with ${esc(data.previousRange.from)} to ${esc(data.previousRange.to)}</small></p><div class="dyws-report-cards">${cards.map(c=>`<div class="dyws-report-card"><span>${esc(c.label)}</span><strong>${esc(c.value)}</strong><small>${esc(c.detail)}</small></div>`).join('')}</div>${!s.orders&&!s.captured&&!s.refunded?'<p class="dyws-note">No activity in this range. Try a longer period.</p>':''}<div class="dyws-report-grid">${graph('netCollected','Payment trend',false)}${graph('orders','Orders by day',true)}</div><div class="dyws-report-grid"><section><h2>Order flow</h2><div class="dyws-report-bars">${r.statuses.filter(row=>row.count).map(row=>`<div><span>${esc(statusText(row.status))}</span><strong>${row.count}</strong><meter min="0" max="${maxStatus}" value="${row.count}" aria-label="${esc(statusText(row.status))}">${row.count}</meter></div>`).join('')||'<p>No orders yet.</p>'}</div><p class="dyws-note">${r.fulfillment.map(f=>`${f.count} ${f.fulfillment}`).join(' · ')}<br>${s.cancellationRate??0}% cancelled</p></section><section><h2>At a glance</h2><dl class="dyws-report-facts"><div><dt>Active orders</dt><dd>${s.active}</dd></div><div><dt>Awaiting payment</dt><dd>${s.unpaidOrders} · ${fmt(s.unpaidValue)}</dd></div><div><dt>Preparation</dt><dd>${minutes(s.preparationSeconds)} <small>(${s.preparationSamples} ${s.preparationSamples===1?'order':'orders'})</small></dd></div><div><dt>Delivery</dt><dd>${minutes(s.deliverySeconds)} <small>(${s.deliverySamples} ${s.deliverySamples===1?'order':'orders'})</small></dd></div></dl><small>For orders created in this range. Durations use completed event pairs.</small></section></div><section><div class="dyws-report-heading"><h2>Popular items</h2><button class="dyws-secondary" data-csv="items">Export items</button></div><p class="dyws-note">Quantities and ordered value, excluding cancelled orders.</p>${table('Popular items',['Item','Quantity',`Ordered subtotal (${data.currency})`],itemRows)}</section><details data-detail="daily"><summary>Daily data and payment breakdown</summary><dl class="dyws-report-facts">${[['Test payments',s.captured],['Test refunds',s.refunded],['Net product payments',s.netSales],['Net delivery fees',s.netDeliveryFees],['Net tax',s.netTax]].map(([name,value])=>`<div><dt>${name}</dt><dd>${fmt(value)}</dd></div>`).join('')}</dl><div class="dyws-actions"><button class="dyws-secondary" data-csv="daily">Export daily data</button></div>${table('Daily data',dailyHeaders,dailyRows)}</details><details data-detail="hours"><summary>Order times</summary>${table('Orders by hour',['Hour, '+data.timeZone,'Orders'],r.hours.map(h=>[String(h.hour).padStart(2,'0')+':00',h.count]))}</details></div>`;
  for(const node of root.querySelectorAll('details'))node.open=open.includes(node.dataset.detail);
  const exportRows=async(key,rows)=>{const result=await applyFilters('reports:export',rows,{key,report:data});download(csvText(result),'text/csv;charset=utf-8',`dyws-${key}-${data.range.from}-${data.range.to}.csv`);};
  root.querySelectorAll('[data-csv]').forEach(b=>b.onclick=()=>exportRows(b.dataset.csv,[['Currency',data.currency,'From',data.range.from,'To',data.range.to,'Fulfilment',data.fulfillment,'Timezone',data.timeZone],b.dataset.csv==='items'?['Item','Option','Quantity','Ordered subtotal (cents)']:['Day','Orders','Ordered value (cents)','Test payments (cents)','Test refunds (cents)','Net test payments (cents)'],...(b.dataset.csv==='items'?r.items.map(i=>[i.name,i.option,i.quantity,i.orderedSubtotal]):r.daily.map(d=>[d.date,d.orders,d.orderedValue,d.captured,d.refunded,d.netCollected]))]));
  root.querySelectorAll('[data-svg]').forEach(b=>b.onclick=()=>download(b.closest('section').querySelector('svg').outerHTML,'image/svg+xml',`dyws-${b.dataset.svg}-${data.range.from}.svg`));
  states.set(root,signature);await runAction('admin:tables',{root,phase:'mount'});return true;
 });
}
