import {statusBadge} from './status-badge.js';
import {escapeHTML as esc,money,statusText} from './api.js';
import {formatDateTime,getTimeZone,dateKey} from './date-time.js';
import {orderDateRange,matchesOrderDate} from './order-date-filter.js';

const terminal=new Set(['completed','delivered','cancelled']);
export const isActiveOrder=order=>!terminal.has(order.status);
export const sortOrders=orders=>[...orders].sort((a,b)=>Number(isActiveOrder(b))-Number(isActiveOrder(a))||b.created_at-a.created_at||a.id.localeCompare(b.id));
export const matchesOrderStatus=(status,filter)=>filter==='active'?!terminal.has(status):filter==='complete'?['completed','delivered'].includes(status):!filter||status===filter;
const statusOptions=[['active','Active'],['','All'],['complete','Completed'],['cancelled','Cancelled'],['placed','Placed'],['accepted','Accepted'],['preparing','Preparing'],['ready','Ready'],['out_for_delivery','Out for delivery']];

/** One compact summary per order. Contact details and actions open on demand. */
export function mountOrderList({root,plugins,renderOrder}){
 const initial=root.querySelector('[data-dyws-order-initial]');
 root.innerHTML=`<p class="dyws-note">Up to 200 orders · Active first · <span data-order-zone></span></p><div class="dyws-order-filters"><label>Search<input type="search" data-order-search placeholder="Order or customer"></label><label>Date<select data-order-date><option value="">All dates</option><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="week">This week</option><option value="month">This month</option></select></label>${[['status','Status'],['fulfillment','Type'],['payment_status','Payment']].map(([key,label])=>`<label>${label}<select data-order-filter="${key}">${key==='status'?statusOptions.map(([value,label])=>`<option value="${value}">${label}</option>`).join(''):'<option value="">All</option>'}</select></label>`).join('')}</div><div class="dyws-order-table"></div><section class="dyws-order-detail" hidden aria-label="Order details"><button type="button" class="dyws-secondary" data-close-order><span aria-hidden="true">×</span> Close details</button><div data-order-content></div></section>`;
 const tableRoot=root.querySelector('.dyws-order-table'),detail=root.querySelector('.dyws-order-detail'),content=root.querySelector('[data-order-content]'),search=root.querySelector('[data-order-search]'),filters=[...root.querySelectorAll('[data-order-filter]')];
 if(initial)tableRoot.append(initial);
 const date=root.querySelector('[data-order-date]');
 let current={orders:[],drivers:[]},selected=null,signature='',instance=null;
 const show=()=>{const order=current.orders.find(o=>o.id===selected);detail.hidden=!order;if(order)renderOrder(order,current,content);else content.replaceChildren();};
 const filter=(resetPaging=true)=>{
  const range=orderDateRange(date.value);
  if(instance){instance.search(search.value);instance.column(1).search(range?value=>matchesOrderDate(value,range):'');filters.forEach((control,i)=>instance.column(i+3).search(control.dataset.orderFilter==='status'?value=>matchesOrderStatus(value.replaceAll(' ','_'),control.value):control.value,{exact:true}));instance.draw(resetPaging);return;}
  for(const row of tableRoot.querySelectorAll('tbody tr')){const order=current.orders.find(o=>o.id===row.dataset.orderId);row.hidden=!!order&&(!matchesOrderDate(dateKey(order.created_at*1000),range)||!row.textContent.toLowerCase().includes(search.value.toLowerCase())||filters.some(control=>control.dataset.orderFilter==='status'?!matchesOrderStatus(order.status,control.value):control.value&&statusText(order[control.dataset.orderFilter])!==control.value));}
 };
 search.oninput=()=>filter();date.onchange=()=>filter();filters.forEach(control=>control.onchange=()=>filter());
 tableRoot.onclick=event=>{const button=event.target.closest('[data-open-order]');if(!button)return;selected=button.dataset.openOrder;show();detail.scrollIntoView({block:'nearest'});detail.querySelector('[data-close-order]').focus({preventScroll:true});};
 root.querySelector('[data-close-order]').onclick=()=>{const id=selected;selected=null;show();tableRoot.querySelector(`[data-open-order="${id}"]`)?.focus({preventScroll:true});};
 return {
  async update(data,{force=false}={}){
   data={...data,orders:sortOrders(data.orders)};current=data;
   const focused=root.ownerDocument.activeElement,editing=focused?.matches?.('input,select,textarea,[contenteditable="true"]');
   // Preserve a selection or typed value while an operator is working.
   if(force||!editing||!detail.contains(focused))show();
   const key=JSON.stringify([getTimeZone(),dateKey(),data.orders.map(o=>[o.id,o.created_at,o.customer_name,o.status,o.fulfillment,o.payment_status,o.total,o.currency])]);
   if(key===signature||(!force&&editing&&(tableRoot.contains(focused)||filters.includes(focused)||focused===date)))return;
   signature=key;root.querySelector('[data-order-zone]').textContent=getTimeZone();
   await plugins?.runAction('admin:tables',{root:tableRoot,phase:'dispose'});instance=null;
   const restoreOrderFocus=tableRoot.contains(root.ownerDocument.activeElement)?root.ownerDocument.activeElement?.dataset?.openOrder:null;
   for(const control of filters){if(control.dataset.orderFilter==='status')continue;const value=control.value,values=[...new Set(data.orders.map(o=>statusText(o[control.dataset.orderFilter])))].sort();if(value&&!values.includes(value))values.push(value);control.innerHTML='<option value="">All</option>'+values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');control.value=value;}
   tableRoot.innerHTML=`<div class="dyws-table-wrap"><table data-dyws-table="orders"><caption class="dyws-visually-hidden">Orders, active first</caption><thead><tr>${['Order','Placed','Customer','Status','Type','Payment','Total','Priority'].map(label=>`<th scope="col" ${label==='Priority'?'hidden':''}>${label}</th>`).join('')}</tr></thead><tbody>${data.orders.map(o=>`<tr data-order-id="${esc(o.id)}"><td><button type="button" class="dyws-secondary" data-open-order="${esc(o.id)}" aria-label="View order ${esc(o.id)}">${esc(o.id)}</button></td><td data-order="${Number(o.created_at)}" data-search="${dateKey(o.created_at*1000)}">${esc(formatDateTime(o.created_at))}</td><td>${esc(o.customer_name)}</td><td data-search="${esc(statusText(o.status))}" data-order="${esc(o.status)}">${statusBadge(o.status)}</td><td data-search="${esc(o.fulfillment)}">${statusBadge(o.fulfillment)}</td><td data-search="${esc(statusText(o.payment_status))}">${statusBadge(o.payment_status)}</td><td data-order="${Number(o.total)}">${esc(money(o.total,o.currency))}</td><td hidden>${isActiveOrder(o)?0:1}</td></tr>`).join('')}</tbody></table></div>`;
   await plugins?.runAction('admin:tables',{root:tableRoot,options:{language:{zeroRecords:'No matching orders. Try another date, status or search.'},order:[[1,'desc']],orderFixed:{pre:[[7,'asc']]},columnDefs:[{targets:7,visible:false,searchable:false}],layout:{topEnd:null}},ready:table=>{instance=table;filter(false);}});
   if(!instance)filter();
   if(restoreOrderFocus&&(!root.ownerDocument.activeElement||root.ownerDocument.activeElement===root.ownerDocument.body||root.ownerDocument.activeElement===focused))tableRoot.querySelector(`[data-open-order="${restoreOrderFocus}"]`)?.focus({preventScroll:true});
  },
  async clear(){await plugins?.runAction('admin:tables',{root:tableRoot,phase:'dispose',forget:true});instance=null;signature='';selected=null;current={orders:[],drivers:[]};tableRoot.replaceChildren();show();search.value='';date.value='';filters.forEach(control=>control.value=control.dataset.orderFilter==='status'?'active':'');},
  destroy(){return plugins?.runAction('admin:tables',{root:tableRoot,phase:'dispose',forget:true});}
 };
}
