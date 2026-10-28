import {escapeHTML as esc,money,statusText} from './api.js';
import {formatDateTime} from './date-time.js';
import {customerAccountPreviewHTML,customerPreviewOrders} from './customer-account-preview.js';
import {mountCustomerOrders} from './customer-orders.js';

export const driverReportReasons={late:'Late delivery',conduct:'Driver conduct',handling:'Order handling',other:'Other concern'};
export function customerOrderHTML(o){
 const price=n=>money(n,o.currency),reportable=o.canReport&&!o.report;
 const reportForm=reportable?`<details data-driver-report><summary>Report driver</summary><form data-report><label>What went wrong?<select name="reason" required><option value="">Choose a reason</option>${Object.entries(driverReportReasons).map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></label><label>Details (optional)<textarea name="details" maxlength="2000"></textarea></label><label class="dyws-check"><input type="checkbox" name="blockDriver" ${o.driverBlocked?'checked':''}><span>Also block this driver from my future deliveries at this store</span></label><p>The store can read your report. The block covers every delivery address on your account.</p><button type="submit">Submit report</button></form></details>`:'';
 return `<article class="dyws-customer-order-detail" data-order="${esc(o.id)}"><header class="dyws-customer-order-heading"><div><span class="dyws-customer-status" data-status="${esc(o.status)}">${esc(statusText(o.status))}</span><h3>${esc(o.id)}</h3><p>${esc(formatDateTime(o.createdAt))}</p></div><div><p class="dyws-order-detail-total">${price(o.total)}</p><p>Payment ${esc(statusText(o.paymentStatus))}</p></div></header>
 <div class="dyws-order-destination"><div><h4>${o.fulfillment==='delivery'?'Delivery to':'Pickup location'}</h4><p>${esc(o.deliveryAddress||o.orderLocation?.address||o.orderLocation?.name||'')}</p></div><div><h4>${esc(o.orderLocation?.name||'Store')}</h4><p>${esc(o.fulfillmentMeta?.label||o.fulfillment)}</p></div></div>
 <details class="dyws-order-receipt" open><summary>Receipt</summary><ul>${o.lines.map(l=>`<li><span>${l.quantity} × ${esc(l.name)} ${esc(l.option)}</span><strong>${price(l.price*l.quantity)}</strong></li>`).join('')}</ul><dl>${[['Items',o.subtotal],['Delivery',o.deliveryFee],['Tax',o.tax],['Tip',o.tip],['Total',o.total]].map(([label,n])=>`<dt>${label}</dt><dd>${price(n)}</dd>`).join('')}</dl></details>
 ${o.driver?`<section class="dyws-customer-driver" aria-label="Driver information"><div class="dyws-driver-overview"><span class="dyws-customer-driver-avatar" aria-hidden="true">${esc(Array.from(o.driver.name)[0]||'D')}</span><div><h4>Driver: ${esc(o.driver.name)}</h4><p>${esc([o.driver.vehicleColor,o.driver.vehicleType].filter(Boolean).join(' · '))}</p><p>${o.status==='delivered'?'Delivered your order':o.status==='out_for_delivery'?'Your delivery is on the way':'Assigned to your order'}</p></div></div>
 ${o.driverBlocked?'<p><strong>This driver is blocked for your account at this store.</strong></p>':''}
 <div class="dyws-driver-controls" role="group" aria-label="Driver controls"><button type="button" ${reportable?'data-open-report':'disabled'}>${o.report?'Report submitted':'Report driver'}</button>${o.driverBlocked?`<button type="button" data-unblock="${esc(o.driver.id)}">Unblock driver</button>`:`<button type="button" ${o.canReport?'data-block':'disabled'}>Block driver for future deliveries</button>`}</div>
 ${o.report?`<p>Report submitted: ${esc(driverReportReasons[o.report.reason]||o.report.reason)}</p><p>${esc(o.report.details)}</p>`:''}${reportForm}</section>`:''}</article>`;
}

export function customerSignInHTML({locked=false}={}){
 return `<section aria-labelledby="customer-signin-heading"><h2 id="customer-signin-heading">Sign in with your email</h2><p>Already have an account? Enter its email address and we will send you a secure sign in link.</p><form data-login><fieldset class="dyws-account-preview" ${locked?'disabled':''}><label>Email<input name="email" type="email" maxlength="254" autocomplete="email" autocapitalize="none" spellcheck="false" required ${locked?'value="demo.customer@example.test" disabled':''}></label><button type="submit" ${locked?'disabled':''}>Email me a sign in link</button></fieldset><p>No password needed. Your first sign in creates your account automatically. The link expires in 15 minutes.</p></form></section>`;
}

export function mountCustomerAccount({root,message,error,api,loginToken=null,demoLocked=false,storeName='',view='account',ordersURL='orders/',signinLocked=false}){
 if(view==='signin'&&signinLocked){
  message.textContent='This is a public demo. Email sign in is locked by the installation owner. No email will be sent.';
  root.innerHTML=customerSignInHTML({locked:true})+`<p><a href="${esc(new URL('../',ordersURL).href)}">Explore the demo customer account</a></p>`;root.addEventListener('submit',event=>event.preventDefault());
  return {refresh:async()=>{},openLink:async()=>{}};
 }
 if(demoLocked){
  message.textContent='This is a public demo. All customer details, orders and drivers below are fictional. Account controls are locked. No emails or reports are sent.';
  const lock=scope=>{
   const report=scope.querySelector('[data-report]');if(report){report.elements.reason.value='handling';report.elements.details.value='Example report: the packaging was damaged.';report.elements.blockDriver.checked=true;}
   for(const control of scope.querySelectorAll('input,select,textarea,button')){if(control.hasAttribute('data-select-order'))continue;control.disabled=true;control.title='Locked by the installation owner';}
   for(const form of scope.querySelectorAll('form')){const fieldset=scope.ownerDocument.createElement('fieldset');fieldset.disabled=true;fieldset.className='dyws-account-preview';fieldset.append(...form.childNodes);form.append(fieldset);}
  };
  if(view==='orders'){
   root.innerHTML='<p>Order history for <strong>Demo Customer</strong></p><div class="dyws-actions"><button type="button" disabled>Refresh orders</button></div><div data-history></div><button type="button" disabled>More orders</button>';
   mountCustomerOrders({root:root.querySelector('[data-history]'),orders:customerPreviewOrders(storeName),detailHTML:customerOrderHTML,onDetail:lock});
  }else{root.innerHTML=customerAccountPreviewHTML({storeName});lock(root);}
  root.addEventListener('submit',event=>event.preventDefault());
  // No account handlers or API calls are mounted for a demo, including pasted login links.
  return {refresh:async()=>{},openLink:async()=>{}};
 }
 const call=(route,options={})=>api(route,{...options,customer:true});
 let busy=false,orders=[],nextOffset=null,historyBrowser=null;
 function say(text){message.textContent=text;}
 async function action(fn){if(busy)return;busy=true;error.textContent='';root.inert=true;try{await fn();}catch(e){error.textContent=e.message;if(e.status===401)await load();}finally{busy=false;root.inert=false;}}
 function signin(state){
  orders=[];nextOffset=null;say(state.message);
  historyBrowser?.destroy();historyBrowser=null;
  root.innerHTML=state.enabled?customerSignInHTML():'';
  root.querySelector('form')?.addEventListener('submit',e=>{e.preventDefault();const email=e.currentTarget.elements.email.value;void action(async()=>{const result=await call('/customer/auth/request',{method:'POST',body:{email}});say(result.message);});});
 }
 async function historyPage(offset=0){
  const result=await call('/customer/orders?offset='+offset);
  orders=offset?[...orders,...result.orders]:result.orders;nextOffset=result.nextOffset;
  historyBrowser?.destroy();
  if(view==='orders')historyBrowser=mountCustomerOrders({root:root.querySelector('[data-history]'),orders,detailHTML:customerOrderHTML});
  else root.querySelector('[data-history]').innerHTML=orders.map(customerOrderHTML).join('')||'<p>Your orders will appear here when you order while signed in. You can also save an existing order from its private tracking page.</p>';
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
  root.innerHTML='<div class="dyws-actions"><button type="button" data-refresh>Refresh orders</button></div><section><h2>Order history</h2><div data-history></div><button type="button" data-more hidden>More orders</button></section><section><h2>Blocked drivers</h2><p>Blocks apply to every delivery address when you order with this account at this store. A delivery already on the way may still arrive. Contact the store if you need help with it.</p><ul data-blocks role="list"></ul></section>';
  await historyPage();await blocks();
 }
 root.addEventListener('submit',e=>{
  if(!e.target.matches('[data-report]'))return;e.preventDefault();const form=e.target,id=form.closest('[data-order]').dataset.order;
  const body={reason:form.elements.reason.value,details:form.elements.details.value,blockDriver:form.elements.blockDriver.checked};
  void action(async()=>{await call('/customer/orders/'+id+'/report',{method:'POST',body});await load();say(body.blockDriver?'Report submitted. This driver is blocked from your future deliveries at this store.':'Your report has been submitted to the store.');});
 });
 root.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||busy)return;
  if(b.hasAttribute('data-refresh'))void action(load);
  else if(b.hasAttribute('data-open-report')){const details=b.closest('[data-order]').querySelector('[data-driver-report]');if(details){details.open=true;details.querySelector('select')?.focus();}}
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
