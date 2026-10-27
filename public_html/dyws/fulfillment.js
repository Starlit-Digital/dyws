import {escapeHTML as esc} from './api.js';
export function localParts(millis, timeZone){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(millis)).map(p=>[p.type,p.value]));
 return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`};
}
export function fulfillmentHTML(order){
 const meta=order.fulfillmentMeta||{type:order.fulfillment,label:order.fulfillment==='delivery'?'Delivery':'Pickup'};
 return `<div class="dyws-fulfillment-summary" data-dyws-fulfillment data-order-type="${esc(meta.type)}"${meta.scheduled?` data-pickup-date="${esc(meta.localDate)}" data-pickup-time="${esc(meta.localTime)}" data-pickup-time-zone="${esc(meta.timeZone)}" data-pickup-at="${esc(meta.scheduledAtUtc)}"`:''}><strong>${esc(meta.label)}</strong>${meta.scheduled?`<br><time datetime="${esc(meta.scheduledAtUtc)}">${esc(meta.localDate)} at ${esc(meta.localTime)}</time><br><small>${esc(meta.timeZone)}</small>`:meta.type==='pickup'?'<br><small>As soon as ready</small>':''}</div>`;
}
