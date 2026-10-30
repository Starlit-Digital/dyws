import {formatPhoneInput} from './phone-input.js';
import {fulfillmentHTML} from './fulfillment.js';
import {escapeHTML,money} from './api.js';
import {formatDateTime} from './date-time.js';

/** Render only the customer fields returned by the private tracking endpoint. */
export function trackingDetails(order) {
 const summary=order.summary,business=order.business||{},pickup=order.fulfillment==='pickup';
 const amount=value=>escapeHTML(money(value,summary.currency));
 const rows=summary?.lines?.map(line=>`<li><span><strong>${escapeHTML(line.quantity)} × ${escapeHTML(line.name)}</strong>${line.option?`<small>${escapeHTML(line.option)}</small>`:''}</span><span>${amount(line.quantity*line.price)}</span></li>`).join('');
 const receipt=rows?`<h3>Items</h3><ul class="dyws-tracking-items">${rows}</ul><dl class="dyws-tracking-totals">${summary.discount?`<div><dt>${escapeHTML(summary.deal?.name||'Deal savings')}</dt><dd>−${amount(summary.discount)}</dd></div>`:''}<div><dt>Subtotal</dt><dd>${amount(summary.subtotal)}</dd></div>${!pickup?`<div><dt>Delivery</dt><dd>${amount(summary.deliveryFee)}</dd></div>`:''}<div><dt>Tax</dt><dd>${amount(summary.tax)}</dd></div>${summary.tip?`<div><dt>Tip</dt><dd>${amount(summary.tip)}</dd></div>`:''}<div class="dyws-tracking-total"><dt>Total <small>${escapeHTML(summary.currency)}</small></dt><dd>${amount(summary.total)}</dd></div></dl>`:'';
 const address=pickup?(order.orderLocation?.address||business.pickupAddress):order.deliveryAddress;
 const fulfillment=`${fulfillmentHTML(order)}${address?`<p class="dyws-tracking-address">${pickup&&(order.orderLocation?.name||business.name)?`<strong>${escapeHTML(order.orderLocation?.name||business.name)}</strong><br>`:''}${escapeHTML(address)}${pickup?`<br><a class="dyws-tracking-directions" href="https://www.google.com/maps/dir/?api=1&amp;destination=${encodeURIComponent(address)}" target="_blank" rel="noopener noreferrer">Directions ↗</a>`:''}</p>`:''}${Number.isFinite(order.createdAt)?`<p class="dyws-note">Ordered ${escapeHTML(formatDateTime(order.createdAt))}</p>`:''}`;
 const phone=String(business.phone||''),dial=phone.replace(/[^0-9+]/g,'');
 const help=`${dial?`<a class="dyws-tracking-contact" href="tel:${escapeHTML(dial)}">Call ${escapeHTML(business.name||'the business')}<small>${escapeHTML(formatPhoneInput(phone))}</small></a>`:''}`;
 return {receipt,fulfillment,help};
}
