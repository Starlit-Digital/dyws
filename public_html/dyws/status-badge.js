import {escapeHTML,statusText} from './api.js';
const states={
 placed:['Received','info','•'],accepted:['Accepted','info','•'],preparing:['Preparing','warning','•'],ready:['Ready','ready','✓'],
 out_for_delivery:['On the way','info','→'],delivered:['Delivered','success','✓'],completed:['Completed','success','✓'],cancelled:['Cancelled','neutral','×'],
 unpaid:['Unpaid','warning','!'],paid:['Paid','success','✓'],partially_refunded:['Partly refunded','warning','↩'],refunded:['Refunded','neutral','↩'],failed:['Failed','danger','!'],
 pickup:['Pickup','ready','↗'],delivery:['Delivery','info','→'],planned:['Planned','ready','•'],active:['Active','success','✓'],inactive:['Inactive','neutral','–'],
 enabled:['Enabled','success','✓'],disabled:['Disabled','neutral','–'],locked:['Locked','neutral','•'],demo:['Demo','warning','•'],live:['Live','success','•'],delayed:['Delayed','warning','!']
};
/** Labels and shapes communicate state even without colour. Never accept markup. */
export function statusBadge(value,label){
 const key=String(value??'');const [name,tone,icon]=Object.hasOwn(states,key)?states[key]:[statusText(key)||'Unknown','neutral','•'];
 return `<span class="dyws-status-badge" data-dyws-status="${escapeHTML(key)}" data-tone="${tone}"><span class="dyws-status-glyph" aria-hidden="true">${icon}</span>${escapeHTML(label??name)}</span>`;
}
