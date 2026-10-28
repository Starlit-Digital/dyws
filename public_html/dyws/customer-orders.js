import {escapeHTML as esc,money,statusText} from './api.js';
import {formatDateTime} from './date-time.js';

/** Selection only. The owning account controller authorizes every order action. */
export function mountCustomerOrders({root,orders,detailHTML,onDetail=()=>{}}){
 if(!orders.length){root.innerHTML='<p>Your orders will appear here when you order while signed in.</p>';return {destroy(){}};}
 root.innerHTML=`<div class="dyws-customer-orders"><aside class="dyws-customer-order-rail" aria-label="Your orders"><div class="dyws-order-rail-heading"><h2>Order history</h2><span>${orders.length} orders</span></div><ul>${orders.map(o=>`<li><button type="button" class="dyws-customer-order-card" data-select-order="${esc(o.id)}" aria-pressed="false" aria-controls="dyws-selected-order"><span class="dyws-order-card-top"><strong>${esc(o.id)}</strong><span>${money(o.total,o.currency)}</span></span><span class="dyws-order-card-date">${esc(formatDateTime(o.createdAt))}</span><span class="dyws-order-card-items">${esc(o.lines.map(l=>l.quantity+' × '+l.name).join(', '))}</span><span class="dyws-order-card-bottom"><span class="dyws-customer-status" data-status="${esc(o.status)}">${esc(statusText(o.status))}</span><span>${esc(o.fulfillmentMeta?.label||o.fulfillment)}</span></span></button></li>`).join('')}</ul></aside><div id="dyws-selected-order" data-order-details role="region" aria-label="Selected order" tabindex="-1"></div><p class="dyws-order-selection-status" role="status" aria-live="polite"></p></div>`;
 const detail=root.querySelector('[data-order-details]');
 function select(id,focus=false){
  const order=orders.find(o=>o.id===id);if(!order)return;
  for(const card of root.querySelectorAll('[data-select-order]'))card.setAttribute('aria-pressed',String(card.dataset.selectOrder===id));
  detail.innerHTML=detailHTML(order);onDetail(detail,order);root.querySelector('[role=status]').textContent='Showing '+id;
  if(focus&&root.ownerDocument.defaultView.matchMedia('(max-width:800px)').matches)detail.focus();
 }
 const clicked=event=>{const card=event.target.closest('[data-select-order]');if(card&&root.contains(card))select(card.dataset.selectOrder,true);};
 root.addEventListener('click',clicked);select(orders[0].id);
 return {select,destroy(){root.removeEventListener('click',clicked);}};
}
