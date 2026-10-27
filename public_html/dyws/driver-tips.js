import {escapeHTML as esc,money} from './api.js';
import {formatDateTime} from './date-time.js';

export function renderDriverTips(data){
 if(!data)return '';
 const table=(caption,headers,rows)=>`<div class="dyws-table-wrap" tabindex="0" role="region" aria-label="${esc(caption)}"><table><caption>${esc(caption)}</caption><thead><tr>${headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(value=>`<td>${esc(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
 return `<h2>My tips</h2><p class="dyws-note">Completed paid deliveries, after tip refunds. Dates use ${esc(data.timeZone)}. Later refunds update the original delivery period. These totals track earnings, not payouts.</p>${data.currencies.length?data.currencies.map(group=>{
  const amount=value=>money(value,group.currency);
  const periods=[['today','Today'],['week','This week'],['month','This month'],['year','This year'],['allTime','All time']];
  return `<h3>${esc(group.currency)}</h3><dl class="dyws-tip-periods">${periods.map(([key,label])=>`<div><dt>${label}</dt><dd>${esc(amount(group.periods[key].net))}</dd></div>`).join('')}</dl><p>All time tips: ${esc(amount(group.periods.allTime.gross))} · Refunded: ${esc(amount(group.periods.allTime.refunded))}</p>${[['daily','By day'],['weekly','By week, starting Monday'],['monthly','By month']].map(([key,label])=>`<details><summary>${label}</summary>${table(label,['Period','Tips','Refunded','Net tips'],group[key].map(row=>[row.date,amount(row.gross),amount(row.refunded),amount(row.net)]))}</details>`).join('')}`;
 }).join(''):'<p>No earned tips yet. Tips appear here once a paid delivery is completed.</p>'}${data.recentOrders.length?`<details><summary>Recent tipped deliveries, up to 50</summary>${table('Recent tipped deliveries',['Order','Delivered','Tip','Refunded','Net tip'],data.recentOrders.map(order=>[order.id,formatDateTime(order.earnedAt),money(order.tip,order.currency),money(order.refundedTip,order.currency),money(order.netTip,order.currency)]))}</details>`:''}`;
}
