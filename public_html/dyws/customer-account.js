import {escapeHTML as esc,money,statusText} from './api.js';
import {formatDateTime} from './date-time.js';

export const driverReportReasons={late:'Late delivery',conduct:'Driver conduct',handling:'Order handling',other:'Other concern'};
export function customerOrderHTML(o){
 const price=n=>money(n,o.currency);
 return `<article data-order="${esc(o.id)}"><h3>${esc(o.id)}</h3><p>${esc(formatDateTime(o.createdAt))} · ${esc(statusText(o.status))}</p><p>${esc(o.orderLocation?.name||'')} · ${esc(o.fulfillmentMeta?.label||o.fulfillment)}</p>${o.deliveryAddress?`<p>${esc(o.deliveryAddress)}</p>`:''}<p>Total <strong>${price(o.total)}</strong> · Payment ${esc(statusText(o.paymentStatus))}</p><details><summary>Receipt</summary><ul>${o.lines.map(l=>`<li>${l.quantity} × ${esc(l.name)} ${esc(l.option)} · ${price(l.price*l.quantity)}</li>`).join('')}</ul><p>Items ${price(o.subtotal)} · Delivery ${price(o.deliveryFee)} · Tax ${price(o.tax)} · Tip ${price(o.tip)}</p></details>${o.driver?`<p>Driver: ${esc(o.driver.name)}</p>`:''}${o.report?`<p>Report submitted: ${esc(driverReportReasons[o.report.reason]||o.report.reason)}</p><p>${esc(o.report.details)}</p>`:''}${o.driverBlocked?'<p><strong>This driver is blocked for your account at this store.</strong></p>':''}${o.canReport?`${!o.report?`<details><summary>Report driver</summary><form data-report><label>What went wrong?<select name="reason" required><option value="">Choose a reason</option>${Object.entries(driverReportReasons).map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></label><label>Details (optional)<textarea name="details" maxlength="2000"></textarea></label><label class="dyws-check"><input type="checkbox" name="blockDriver" ${o.driverBlocked?'checked':''}><span>Also block this driver from my future deliveries at this store</span></label><p>The store can read your report. The block covers every delivery address on your account.</p><button type="submit">Submit report</button></form></details>`:''}${!o.driverBlocked?'<button type="button" data-block>Block driver for future deliveries</button>':''}`:''}</article>`;
}

export function mountCustomerAccount({root,message,error,api,loginToken=null}){
 const call=(route,options={})=>api(route,{...options,customer:true});
 let busy=false,orders=[],nextOffset=null;
 function say(text){message.textContent=text;}
 async function action(fn){if(busy)return;busy=true;error.textContent='';root.inert=true;try{await fn();}catch(e){error.textContent=e.message;if(e.status===401)await load();}finally{busy=false;root.inert=false;}}
 function signin(state){
  orders=[];nextOffset=null;say(state.message);
  root.innerHTML=state.enabled?'<form data-login><label>Email<input name="email" type="email" maxlength="254" autocomplete="email" required></label><button type="submit">Email me a sign in link</button><p>No password needed. Your first sign in creates your account automatically.</p></form>':'';
  root.querySelector('form')?.addEventListener('submit',e=>{e.preventDefault();const email=e.currentTarget.elements.email.value;void action(async()=>{const result=await call('/customer/auth/request',{method:'POST',body:{email}});say(result.message);});});
 }
 async function historyPage(offset=0){
  const result=await call('/customer/orders?offset='+offset);
  orders=offset?[...orders,...result.orders]:result.orders;nextOffset=result.nextOffset;
  root.querySelector('[data-history]').innerHTML=orders.map(customerOrderHTML).join('')||'<p>Your orders will appear here when you order while signed in. You can also save an existing order from its private tracking page.</p>';
  root.querySelector('[data-more]').hidden=nextOffset===null;
 }
 async function blocks(){
  const result=await call('/customer/blocks');
  root.querySelector('[data-blocks]').innerHTML=result.blocks.map(b=>`<li>${esc(b.driverName)} <button type="button" data-unblock="${esc(b.driverId)}">Unblock</button></li>`).join('')||'<li>No blocked drivers.</li>';
 }
 async function load(){
  const state=await call('/customer/session');
  if(!state.customer){signin(state);return;}
  say('Signed in as '+state.customer.email);
  root.innerHTML='<div class="dyws-actions"><button type="button" data-refresh>Refresh orders</button><button type="button" data-logout>Sign out</button></div><section><h2>Order history</h2><div data-history></div><button type="button" data-more hidden>More orders</button></section><section><h2>Blocked drivers</h2><p>Blocks apply to every delivery address when you order with this account at this store. A delivery already on the way may still arrive. Contact the store if you need help with it.</p><ul data-blocks></ul></section>';
  await historyPage();await blocks();
 }
 root.addEventListener('submit',e=>{
  if(!e.target.matches('[data-report]'))return;e.preventDefault();const form=e.target,id=form.closest('[data-order]').dataset.order;
  const body={reason:form.elements.reason.value,details:form.elements.details.value,blockDriver:form.elements.blockDriver.checked};
  void action(async()=>{await call('/customer/orders/'+id+'/report',{method:'POST',body});await load();say(body.blockDriver?'Report submitted. This driver is blocked from your future deliveries at this store.':'Your report has been submitted to the store.');});
 });
 root.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||busy)return;
  if(b.hasAttribute('data-logout'))void action(async()=>{await call('/customer/logout',{method:'POST',body:{}});await load();});
  else if(b.hasAttribute('data-refresh'))void action(load);
  else if(b.hasAttribute('data-more'))void action(()=>historyPage(nextOffset));
  else if(b.hasAttribute('data-block'))void action(async()=>{await call('/customer/orders/'+b.closest('[data-order]').dataset.order+'/block',{method:'POST',body:{}});await load();say('Driver blocked. They cannot be assigned to future deliveries for your account at this store.');});
  else if(b.hasAttribute('data-unblock'))void action(async()=>{await call('/customer/blocks',{method:'POST',body:{action:'unblock',driverId:b.dataset.unblock}});await load();say('Driver unblocked. They can be assigned again.');});
 });
 async function open(){
  if(!loginToken){await load();return;}
  try{
   const link=await call('/customer/auth/inspect',{method:'POST',body:{token:loginToken}});
   say('Continue with '+link.email+'?');
   root.innerHTML=`<p>Only continue if this is your email address.</p><button type="button" data-continue>Continue as ${esc(link.email)}</button> <button type="button" data-another>Use another email</button>`;
   root.querySelector('[data-continue]').onclick=()=>void action(async()=>{await call('/customer/auth/verify',{method:'POST',body:{token:loginToken}});loginToken=null;await load();});
   root.querySelector('[data-another]').onclick=()=>void action(async()=>{loginToken=null;signin(await call('/customer/session'));});
  }catch(e){loginToken=null;await load();error.textContent=e.message;}
 }
 void action(open);
 return {refresh:()=>action(load),openLink:token=>{loginToken=token;return action(open);}};
}
