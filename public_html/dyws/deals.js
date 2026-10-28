import {escapeHTML as esc,money} from './api.js';
export function dealBadge(deal){return deal.type==='quantity'?`${deal.buyQuantity+deal.getQuantity} for ${deal.buyQuantity}`:deal.type==='spend_percent'?`${deal.percentBasisPoints/100}% off`:deal.type==='buy_amount_off'?'Buy and save':'Deal';}
export function dealCards(offers,{currency='CAD',claimed=new Set(),action='claim',disabled=false}={}){
 return offers.map(d=>`<article class="dyws-deal-card"><span class="dyws-deal-badge">${esc(dealBadge(d))}</span><h3>${esc(d.name)}</h3>${d.description?`<p>${esc(d.description)}</p>`:''}<p>${esc(d.rule||'')}</p><p class="dyws-deal-schedule">${esc(d.schedule||'')} · Expires ${esc(d.endsOn)}${d.timeZone?' · '+esc(d.timeZone):''}</p>${!d.activeNow?'<p>Available on the scheduled days.</p>':''}<button type="button" data-${action}-deal="${esc(d.id)}" ${disabled||claimed.has(d.id)||d.canClaim===false?'disabled':''}>${claimed.has(d.id)?'Claimed':d.canClaim===false?'Starts '+esc(d.startsOn):'Claim deal'}</button></article>`).join('');
}
export function mountMenuDeals({ordering,container,showDeals=true}){
 let stopped=false,wallet=null;
 container.querySelector(':scope > .dyws-deals')?.remove();
 const offers=(ordering.catalog.deals||[]).filter(d=>d.enabled&&d.rule);
 for(const controls of container.querySelectorAll('[data-order-item]')){
  const row=controls.closest('.dyws-product');row.querySelectorAll('.dyws-item-deal-badge').forEach(n=>n.remove());const title=row.querySelector('h3');
  for(const d of offers.filter(d=>d.activeNow&&d.itemIds.includes(controls.dataset.orderItem)).slice(0,2)){const badge=document.createElement('span');badge.className='dyws-deal-badge dyws-item-deal-badge';badge.textContent=dealBadge(d);title.append(' ',badge);}
 }
 if(!showDeals||!offers.length)return {destroy(){}};
 const section=document.createElement('section');section.className='dyws-deals';section.id='dyws-deals';section.setAttribute('aria-label','Deals');container.prepend(section);
 const account=new URL('deals/',ordering.accountURL||new URL('account/',document.baseURI)).href;
 const call=(route,options={})=>ordering.customerAPI?.(route,options);
 const paint=()=>{if(stopped)return;const claimed=new Set((wallet?.claims||[]).map(c=>c.deal.id));section.innerHTML=`<h2>Deals</h2><p>Claim a deal now, then use it on an eligible order before it expires. One deal per order.</p><div class="dyws-deal-grid">${dealCards(offers,{currency:ordering.catalog.currency,claimed})}</div><p><a href="${esc(account)}">My deals</a></p><p class="dyws-deal-feedback" role="status" aria-live="polite"></p>`;};paint();
 const click=async event=>{const button=event.target.closest('[data-claim-deal]');if(!button||button.disabled)return;button.disabled=true;const status=section.querySelector('[role=status]');
  try{const result=await call('/customer/deals/claim',{method:'POST',body:{dealId:button.dataset.claimDeal}});if(!result)throw new Error('Sign in from My deals to claim this offer.');wallet=result;paint();section.querySelector('[role=status]').textContent='Deal claimed. It will be selected for your next eligible order.';}
  catch(e){status.textContent=e.status===401?'Sign in from My deals to claim this offer.':e.message;button.disabled=false;}
 };
 section.addEventListener('click',click);
 if(ordering.customerAPI)void call('/customer/deals').then(result=>{wallet=result;paint();}).catch(()=>{});
 return {destroy(){stopped=true;section.removeEventListener('click',click);}};
}
export function mountCustomerDeals({root,message,error,api,demoLocked=false}){
 let wallet=null,busy=false;
 const call=(route,options={})=>api(route,{...options,customer:true});
 function paint(){
  message.textContent=demoLocked?'Fictional demo wallet. Claims stay with this browser for up to 24 hours. No real discount or purchase.':'Claim deals here and choose one for your next eligible order.';
  if(wallet.signInRequired&&!demoLocked){root.innerHTML='<p>Sign in to save deals to your account.</p><a href="../sign-in/">Sign in</a>';return;}
  const claimed=new Set(wallet.claims.map(c=>c.deal.id));
  root.innerHTML=`<section><h2>Your claimed deals</h2>${wallet.claims.length?wallet.claims.map(c=>`<article class="dyws-deal-card"><h3>${esc(c.deal.name)}</h3><p>${esc(c.rule)}</p><p>Expires ${esc(new Intl.DateTimeFormat('en-CA',{timeZone:wallet.timeZone,dateStyle:'medium',timeStyle:'short'}).format(c.expiresAt*1000))} · ${esc(wallet.timeZone)}</p><p>${esc(({used:'Used',expired:'Expired',unavailable:'No longer available',scheduled:'Available on scheduled days',ready:c.active?'Selected for next order':'Ready to use'})[c.state])}</p>${['ready','scheduled'].includes(c.state)?`<button type="button" data-activate-claim="${esc(c.id)}" ${c.active?'disabled':''}>${c.active?'Selected':'Use on next order'}</button>`:''}</article>`).join(''):'<p>No claimed deals yet.</p>'}<button type="button" data-clear-deal>No deal on next order</button></section><section><h2>Available deals</h2><div class="dyws-deal-grid">${dealCards(wallet.offers,{currency:wallet.currency,claimed})||'<p>New deals will appear here.</p>'}</div></section>`;
 }
 async function refresh(){wallet=await call('/customer/deals');paint();}
 const clicked=async event=>{const b=event.target.closest('[data-claim-deal],[data-activate-claim],[data-clear-deal]');if(!b||b.disabled||busy)return;busy=true;b.disabled=true;error.textContent='';
  try{wallet=await call(b.dataset.claimDeal?'/customer/deals/claim':'/customer/deals/activate',{method:'POST',body:b.dataset.claimDeal?{dealId:b.dataset.claimDeal}:{claimId:b.dataset.activateClaim||''}});paint();}catch(e){error.textContent=e.message;b.disabled=false;}finally{busy=false;}
 };
 root.addEventListener('click',clicked);const ready=refresh().catch(e=>{error.textContent=e.message;});return {ready,refresh,openLink:async()=>{},destroy(){root.removeEventListener('click',clicked);}};
}
