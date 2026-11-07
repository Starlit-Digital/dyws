import {escapeHTML as esc,money} from '../../dyws/api.js';
import {comparison,pdfButton} from './charts.js';

export function demandAttributes(count,peak) {
 if(count<=0)return 'class="dyws-heat-0"';
 const ratio=Math.max(0,Math.min(1,count/Math.max(1,peak))),L=.42+.42*ratio,C=.10,h=155*Math.PI/180,a=C*Math.cos(h),b=C*Math.sin(h);
 const l=(L+.3963377774*a+.2158037573*b)**3,m=(L-.1055613458*a-.0638541728*b)**3,t=(L-.0894841775*a-1.291485548*b)**3;
 const rgb=[4.0767416621*l-3.3077115913*m+.2309699292*t,-1.2684380046*l+2.6097574011*m-.3413193965*t,-.0041960863*l-.7034186147*m+1.707614701*t].map(v=>Math.max(0,Math.min(1,v)));
 const y=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2],ink=y>.179?'#000000':'#ffffff';
 return `class="dyws-heat-value" data-demand="${ratio.toFixed(6)}" style="--dyws-demand-l:${(L*100).toFixed(4)}%;--dyws-demand-ink:${ink}"`;
}

export function workingHourGrid(schedule,matrix) {
 const minutes=time=>Number(time.slice(0,2))*60+Number(time.slice(3)),overlap=(h,a,b)=>h*60<b&&(h+1)*60>a;
 const mask=Array.from({length:7},(_,day)=>Array.from({length:24},(_,h)=>{
  if(!schedule?.enabled)return true;
  const current=schedule.days[day],previous=schedule.days[(day+6)%7];
  if(current.mode==='allDay')return true;
  if(current.mode==='hours'){const open=minutes(current.open),close=minutes(current.close);if(overlap(h,open,close>open?close:1440))return true;}
  return previous.mode==='hours'&&minutes(previous.close)<minutes(previous.open)&&overlap(h,0,minutes(previous.close));
 }));
 const hours=Array.from({length:24},(_,h)=>h).filter(h=>mask.some(row=>row[h]));
 const excluded=matrix.reduce((sum,row,d)=>sum+row.reduce((total,count,h)=>total+(mask[d][h]?0:count),0),0);
 return {mask,hours,excluded};
}

export function premiumCards(data) {
 const s=data.current.summary,p=data.previous,amount=v=>money(v,data.currency),percent=v=>v===null?'No data':v+'%';
 return [
  {label:'Repeat customers',value:percent(s.repeatCustomerRate),detail:`${s.repeatCustomers} of ${s.customers} estimated customers`},
  {label:'Items per order',value:s.itemsPerOrder??'No data',detail:`${s.units} items in orders that were not cancelled`},
  {label:'Cancelled order value',value:amount(s.cancelledValue),detail:`${s.cancelled} orders · ${percent(s.cancellationRate)} cancellation rate`},
  {label:'Value per customer',value:amount(s.averageCustomerValue),detail:comparison(s.averageCustomerValue,p.averageCustomerValue,amount)},
  {label:'New customers',value:s.newCustomers,detail:`${s.returningCustomers} customers had an earlier order`},
  {label:'Refunds / payments',value:percent(s.refundRate),detail:`${amount(s.refunded)} refunded in this period`},
  {label:'Average delivery fee',value:amount(s.averageDeliveryFee),detail:'Delivery orders only, excluding cancellations'},
  {label:'Slower deliveries',value:s.deliveryP90Seconds===null?'No data':Math.round(s.deliveryP90Seconds/60)+' min',detail:`90% finished within this time · ${s.deliverySamples} measured orders`}
 ];
}

export function insightsHTML(data) {
 const r=data.current,s=r.summary,amount=v=>money(v,data.currency),days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
 const grid=workingHourGrid(data.workingHours,r.heatmap);
 const totals=r.heatmap.map(hours=>hours.reduce((sum,count)=>sum+count,0)),dayMax=Math.max(1,...totals),max=Math.max(1,...r.heatmap.flatMap((row,d)=>row.filter((_,h)=>grid.mask[d][h]))),minutes=v=>v===null?'No data':Math.round(v/60)+' min';
 const heatmap=`<section class="dyws-demand"><div class="dyws-report-heading"><h2>When customers order</h2>${pdfButton('demand','working hours heatmap')}</div><div class="dyws-demand-key"><div class="dyws-heat-legend" aria-label="Order count colour scale"><span><i class="dyws-heat-0" aria-hidden="true"></i>0</span><span>Less</span><span><i class="dyws-demand-ramp" aria-hidden="true"></i></span><span>More</span></div><span class="dyws-note" title="${esc(data.timeZone)}">${esc(data.timeZone.split('/').at(-1).replaceAll('_',' '))} time</span><details class="dyws-demand-info"><summary>Details</summary><p>Working hours only. Includes cancelled orders. Daily totals and hourly cells use separate colour scales.${grid.excluded?` Daily totals include ${grid.excluded} orders outside these hours.`:''}</p></details></div><div class="dyws-table-wrap" tabindex="0" role="region" aria-label="Order demand by weekday and hour"><table class="dyws-heatmap"><caption class="dyws-visually-hidden">Orders by weekday and working hour</caption><thead><tr><th scope="col">Day</th><th scope="col">Total</th>${grid.hours.map(h=>`<th scope="col">${String(h).padStart(2,'0')}</th>`).join('')}</tr></thead><tbody>${r.heatmap.map((hours,i)=>`<tr><th scope="row">${days[i]}</th><td ${demandAttributes(totals[i],dayMax).replace('class="','class="dyws-day-total ')} title="${days[i]}, ${totals[i]} orders in this period">${totals[i]}</td>${grid.hours.map(h=>!grid.mask[i][h]?`<td class="dyws-demand-closed" title="${days[i]} ${String(h).padStart(2,'0')}:00, closed">Closed</td>`:`<td ${demandAttributes(hours[h],max)} title="${days[i]} ${String(h).padStart(2,'0')}:00, ${hours[h]} orders">${hours[h]}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`;
 const barRows=(rows,label,key)=>{const maximum=Math.max(1,...rows.map(row=>row[key]));return `<div class="dyws-report-bars">${rows.map(row=>`<div><span>${esc(label(row))}</span><strong>${row[key]}</strong><meter min="0" max="${maximum}" value="${row[key]}" aria-label="${esc(label(row))}">${row[key]}</meter></div>`).join('')||'<p>No data for this period.</p>'}</div>`;};
 const locations=`<section><div class="dyws-report-heading"><h2>Location performance</h2>${pdfButton('locations','locations')}</div>${barRows(r.locations,l=>l.name,'orders')}<div class="dyws-table-wrap" tabindex="0" role="region" aria-label="Location performance"><table><caption>Value by location</caption><thead><tr><th scope="col">Location</th><th scope="col">Orders</th><th scope="col">Cancelled</th><th scope="col">Ordered value</th><th scope="col">Average order</th></tr></thead><tbody>${r.locations.map(l=>`<tr><td>${esc(l.name)}</td><td>${l.orders}</td><td>${l.cancelled}</td><td>${esc(amount(l.orderedValue))}</td><td>${esc(amount(l.averageOrder))}</td></tr>`).join('')}</tbody></table></div></section>`;
 const speed=`<section><div class="dyws-report-heading"><h2>Fulfillment speed</h2>${pdfButton('fulfillment','fulfillment times')}</div><p class="dyws-note">Typical time and the time within which 90% finished.</p><div class="dyws-table-wrap" tabindex="0" role="region" aria-label="Fulfillment speed"><table><caption>Measured elapsed times</caption><thead><tr><th scope="col">Stage</th><th scope="col">Median</th><th scope="col">P90</th><th scope="col">Orders</th></tr></thead><tbody>${[['acceptance','Accept order'],['preparation','Prepare order'],['delivery','Deliver order']].map(([key,label])=>`<tr><th scope="row">${label}</th><td>${minutes(s[key+'MedianSeconds'])}</td><td>${minutes(s[key+'P90Seconds'])}</td><td>${s[key+'Samples']}</td></tr>`).join('')}</tbody></table></div></section>`;
 return `${heatmap}<div class="dyws-report-grid">${locations}${speed}</div>`;
}
