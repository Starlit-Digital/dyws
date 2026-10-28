import {escapeHTML as esc} from './api.js';
/** Server quotes are the only source of a claimed discount. No customer data is persisted here. */
export async function mountCheckoutDeals({ordering,form}){
 const root=form.querySelector('[data-checkout-deals]');let sequence=0,selected='',alive=true,wallet=null;
 const call=(route,body)=>ordering.customerAPI?.(route,body?{method:'POST',body}:{});
 if(!root||!ordering.customerAPI)return {read:async()=>null,destroy(){}};
 try{wallet=await call('/customer/deals');}catch{return {read:async()=>null,destroy(){}};}
 const claims=wallet?.claims?.filter(c=>['ready','scheduled'].includes(c.state))||[];
 if(!claims.length){if(ordering.catalog.deals?.length)root.innerHTML=`<p><a href="${esc(new URL('deals/',ordering.accountURL).href)}">Claim a deal in My deals</a></p>`;return {read:async()=>null,destroy(){}};}
 selected=ordering.checkoutDraft?.find(field=>field.name==='dealClaimId')?.value??wallet.activeClaimId??'';root.innerHTML=`<label>Claimed deal<select name="dealClaimId"><option value="">No deal</option>${claims.map(c=>`<option value="${esc(c.id)}">${esc(c.deal.name)}${c.state==='scheduled'?' · Scheduled days only':''}</option>`).join('')}</select></label><p class="dyws-note" role="status" aria-live="polite"></p>`;
 const select=root.querySelector('select');select.value=selected;const status=root.querySelector('[role=status]');
 function payload(){return {lines:ordering.lines,dealClaimId:select.value,fulfillment:form.elements.fulfillment.value,locationId:form.elements.locationId.value,tip:form.elements.addTip.value==='1'?Number(form.elements.tipDollars.value||0)*100:0};}
 async function quote(show=true){const version=++sequence,body=payload();if(!body.dealClaimId){status.textContent='';form.querySelector('.dyws-fulfillment').onchange?.();return null;}
  try{const result=await call('/customer/deals/quote',body);if(alive&&version===sequence&&show){status.textContent='Deal savings '+ordering.amount(result.discount);form.querySelector('.dyws-checkout-total').textContent=(result.deliveryFee?'Delivery '+ordering.amount(result.deliveryFee)+' · ':'')+'Total '+ordering.amount(result.total);}return result;}
  catch(e){if(alive&&version===sequence)status.textContent=e.message;throw e;}
 }
 const changed=()=>{void quote().catch(()=>{});};form.addEventListener('change',changed);form.elements.tipDollars.addEventListener('input',changed);await quote().catch(()=>{});
 return {read:async()=>{if(!select.value)return null;return {dealClaimId:select.value,...await quote(false)};},destroy(){alive=false;sequence++;form.removeEventListener('change',changed);form.elements.tipDollars.removeEventListener('input',changed);}};
}
