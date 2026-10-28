import {escapeHTML as esc} from './api.js';
import {totals} from './cart.js?v=options-20261028';
/** Keep the cart's preview on the same authoritative pricing path as checkout. */
export function mountCartDeals({ordering,content}){
 const root=content.querySelector('[data-cart-deals]');let alive=true,sequence=0,wallet=null,busy=false;
 if(!root||!ordering.customerAPI)return {destroy(){}};
 const call=(route,body)=>ordering.customerAPI(route,body?{method:'POST',body}:{});
 const current=()=>alive&&root.isConnected;
 function reset(){const t=totals(ordering.lines,ordering.catalog.taxBasisPoints);content.querySelector('[data-cart-discount]')?.remove();content.querySelector('[data-dyws-order-field="tax"] dd').textContent=ordering.amount(t.tax);content.querySelector('.dyws-grand-total').textContent='Total '+ordering.amount(t.total);}
 function paint(){
  if(!current())return;
  const claims=wallet.claims||[],ready=claims.filter(c=>['ready','scheduled'].includes(c.state));const claimed=new Set(claims.map(c=>c.deal.id));
  const offers=(wallet.offers||ordering.catalog.deals||[]).filter(d=>d.itemIds.length===0||ordering.lines.some(l=>d.itemIds.includes(l.id)));
  root.innerHTML=`<h3>Deals</h3>${ready.length?`<label>Claimed deal<select data-cart-claim><option value="">No deal</option>${ready.map(c=>`<option value="${esc(c.id)}">${esc(c.deal.name)}</option>`).join('')}</select></label>`:''}<details><summary>${ready.length?'Other deals':'Claim a deal'}</summary>${offers.filter(d=>!claimed.has(d.id)&&d.canClaim!==false).map(d=>`<p>${esc(d.name)} · ${esc(d.rule||'')} <button type="button" data-cart-claim-deal="${esc(d.id)}">Claim deal: ${esc(d.name)}</button></p>`).join('')}</details><p data-cart-deal-status role="status" aria-live="polite"></p><p><a href="${esc(new URL('deals/',ordering.accountURL||new URL('account/',document.baseURI)).href)}">My deals</a></p>`;
  const select=root.querySelector('select');if(select)select.value=wallet.activeClaimId||'';
 }
 async function quote(){
  const version=++sequence;reset();const status=root.querySelector('[data-cart-deal-status]');
  const claim=wallet.activeClaimId;if(!claim){status.textContent='No deal applied. Claim an offer to use it on this order.';return;}
  status.textContent='Checking deal savings…';
  try{const result=await call('/customer/deals/quote',{lines:ordering.lines,dealClaimId:claim,fulfillment:'pickup',tip:0});if(!current()||version!==sequence)return;
   const saved=wallet.claims.find(c=>c.id===claim);const row=document.createElement('div');row.className='dyws-order-pair';row.dataset.cartDiscount='';row.innerHTML=`<dt>${esc(saved?.deal.name||'Deal savings')}</dt><dd>−${ordering.amount(result.discount)}</dd>`;content.querySelector('[data-dyws-order-field="tax"]').before(row);
   content.querySelector('[data-dyws-order-field="tax"] dd').textContent=ordering.amount(result.tax);content.querySelector('.dyws-grand-total').textContent='Total '+ordering.amount(result.total);status.textContent='Deal applied. Delivery and tip are added at checkout.';
  }catch(e){if(current()&&version===sequence)status.textContent='Deal not applied: '+e.message;}
 }
 async function refresh(){wallet=await call('/customer/deals');if(!current())return;wallet.activeClaimId=ordering.checkoutDraft?.find(f=>f.name==='dealClaimId')?.value??wallet.activeClaimId;paint();await quote();}
 const click=async event=>{const button=event.target.closest('[data-cart-claim-deal]');if(!button||button.disabled||busy)return;busy=true;button.disabled=true;content.querySelector('.dyws-checkout').disabled=true;
  try{wallet=await call('/customer/deals/claim',{dealId:button.dataset.cartClaimDeal});if(!current())return;ordering.checkoutDraft=ordering.checkoutDraft?.filter(f=>f.name!=='dealClaimId');paint();await quote();}catch(e){if(current()){root.querySelector('[data-cart-deal-status]').textContent=e.message;button.disabled=false;}}finally{busy=false;if(current())content.querySelector('.dyws-checkout').disabled=false;}
 };
 const change=async event=>{if(!event.target.matches('[data-cart-claim]')||busy)return;busy=true;const select=event.target;select.disabled=true;content.querySelector('.dyws-checkout').disabled=true;
  try{wallet=await call('/customer/deals/activate',{claimId:select.value});if(!current())return;ordering.checkoutDraft=ordering.checkoutDraft?.filter(f=>f.name!=='dealClaimId');paint();await quote();}catch(e){if(current()){root.querySelector('[data-cart-deal-status]').textContent=e.message;select.disabled=false;}}finally{busy=false;if(current())content.querySelector('.dyws-checkout').disabled=false;}
 };
 root.addEventListener('click',click);root.addEventListener('change',change);
 root.innerHTML='<p role="status">Checking available deals…</p>';
 const ready=refresh().catch(()=>{if(current())root.innerHTML='<p role="status">Deals could not be checked. Try again at checkout.</p>';});
 return {ready,destroy(){alive=false;sequence++;root.removeEventListener('click',click);root.removeEventListener('change',change);}};
}
