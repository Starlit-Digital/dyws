import {escapeHTML as esc} from './api.js';

const controlHTML=(state,orders,signin,locked)=>state==='signed-out'
 ?`<a class="account-link" data-dyws-customer-link href="${esc(signin)}">Sign in</a>`
 :`<details class="dyws-account-menu"><summary data-dyws-customer-link aria-label="My account">My account<span aria-hidden="true">▾</span></summary><div class="dyws-account-menu-panel"><a data-dyws-account-orders href="${esc(orders)}">My orders</a><button type="button" data-dyws-account-logout ${locked?'disabled title="Locked by the installation owner"':''}>Sign out</button><p class="dyws-account-menu-status" role="status" aria-live="polite">${locked?'Demo account actions are locked.':''}</p></div></details>`;

export function customerNavigationHTML({accountURL,signedIn=false,locked=false}){
 const signin=new URL('sign-in/',accountURL).href,orders=new URL('orders/',accountURL).href,state=signedIn?'signed-in':'signed-out';
 return `<div class="dyws-customer-navigation-control" data-dyws-customer-navigation data-account-url="${esc(accountURL)}" data-signin-url="${esc(signin)}" data-orders-url="${esc(orders)}" data-demo-locked="${locked}" data-customer-state="${state}">${controlHTML(state,orders,signin,locked)}</div>`;
}

/** Disclosure navigation with guarded logout and session refresh across tabs. */
export function mountCustomerNavigation({root,api,window:win=root.ownerDocument?.defaultView||globalThis.window}){
 const doc=root.ownerDocument||root;let pending=null,destroyed=false,customer=null,busy=false;
 const controls=()=>[...root.querySelectorAll('[data-dyws-customer-navigation]')];
 function paint(){
  for(const wrap of controls()){
   const locked=wrap.dataset.demoLocked==='true',state=customer?'signed-in':locked&&wrap.dataset.previewAccount==='true'?'preview':'signed-out';
   if(wrap.dataset.customerState!==state){const focused=wrap.contains(doc.activeElement);wrap.innerHTML=controlHTML(state,wrap.dataset.ordersUrl,wrap.dataset.signinUrl,locked);wrap.dataset.customerState=state;if(focused)wrap.querySelector('[data-dyws-customer-link]')?.focus();}
   const button=wrap.querySelector('[data-dyws-account-logout]');if(button)button.disabled=locked||busy||!customer;
  }
 }
 async function refresh(){
  if(destroyed)return;const current=controls();if(!current.length)return;if(current.every(w=>w.dataset.demoLocked==='true')){customer=null;paint();return;}if(pending)return pending;
  pending=(async()=>{try{const previous=customer,state=await api('/customer/session',{customer:true});if(!destroyed){customer=state.customer;if(doc.body.dataset.accountView&&previous&&previous.id!==customer?.id){doc.querySelector('[data-account-root]')?.replaceChildren();doc.body.hidden=true;if(customer)win.location.reload();else win.location.assign(controls()[0].dataset.signinUrl);return;}paint();}}catch{/* Preserve the server rendered state while unavailable. */}finally{pending=null;}})();return pending;
 }
 const closeMenus=except=>{for(const menu of root.querySelectorAll('.dyws-account-menu[open]'))if(menu!==except)menu.open=false;};
 const click=async event=>{
  const button=event.target.closest('[data-dyws-account-logout]');if(!button||button.disabled||busy||!customer)return;
  const wrap=button.closest('[data-dyws-customer-navigation]');if(wrap.dataset.demoLocked==='true')return;
  busy=true;paint();const note=wrap.querySelector('[role=status]');note.textContent='Signing out…';
  try{
   await api('/customer/logout',{customer:true,method:'POST',body:{}});customer=null;closeMenus();paint();
   if(doc.body.dataset.accountView){doc.querySelector('[data-account-root]')?.replaceChildren();doc.body.hidden=true;win.location.assign(wrap.dataset.signinUrl);}
   else wrap.querySelector('[data-dyws-customer-link]')?.focus();
  }catch(error){note.textContent=error.message||'Unable to sign out. Please try again.';if(error.status===401)await refresh();}
  finally{busy=false;paint();}
 };
 const outside=event=>{if(!event.target.closest('.dyws-account-menu'))closeMenus();};
 const keyboard=event=>{if(event.key!=='Escape')return;const menu=event.target.closest('.dyws-account-menu[open]');if(menu){menu.open=false;menu.querySelector('summary').focus();event.preventDefault();}};
 const toggle=event=>{if(event.target.matches?.('.dyws-account-menu')&&event.target.open)closeMenus(event.target);};
 const resume=()=>{if(!doc.hidden)void refresh();};
 root.addEventListener('click',click);root.addEventListener('pointerdown',outside);root.addEventListener('keydown',keyboard);root.addEventListener('toggle',toggle,true);
 win.addEventListener('focus',resume);win.addEventListener('pageshow',resume);doc.addEventListener('visibilitychange',resume);void refresh();
 return {refresh,destroy(){destroyed=true;root.removeEventListener('click',click);root.removeEventListener('pointerdown',outside);root.removeEventListener('keydown',keyboard);root.removeEventListener('toggle',toggle,true);win.removeEventListener('focus',resume);win.removeEventListener('pageshow',resume);doc.removeEventListener('visibilitychange',resume);}};
}
