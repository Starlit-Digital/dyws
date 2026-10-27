import {fieldError,clearFieldError} from './checkout-fields.js';

/** Email is contact data until a server session verifies ownership. No browser persistence. */
export function mountCheckoutAccount({form,api,onChange,canRefresh=()=>true}){
 const root=form.querySelector('[data-dyws-checkout-account]'),email=form.elements.email;
 const doc=form.ownerDocument,win=doc.defaultView,events=new AbortController();
 const locked=email.readOnly;let customer=null,enabled=false,sending=false,loading=null,destroyed=false;
 const note=doc.createElement('p'),button=doc.createElement('button');
 note.className='dyws-note';note.setAttribute('role','status');button.type='button';button.className='dyws-muted';button.textContent='Email me a sign in link';button.hidden=true;
 root.append(button,note);
 const render=()=>{button.hidden=!enabled||!!customer;button.disabled=sending;};
 const refresh=()=>{
  if(destroyed||!api)return Promise.resolve();
  if(loading)return loading;
  loading=(async()=>{
   try{
    const state=await api('/customer/session');if(destroyed||!form.isConnected)return;
    const previous=customer;customer=state.customer||null;enabled=state.enabled;
    if(customer){email.value=customer.email;email.readOnly=true;clearFieldError(email);note.textContent='Order as '+customer.email+'. Saved to your account.';}
    else {email.readOnly=locked;if(previous){email.value='';note.textContent='You are signed out. Continue as a guest or request another sign in link.';}
     else if(!sending)note.textContent=enabled?'Sign in for order history and driver preferences. Your first sign in creates your account.':state.message||'';}
    onChange(customer);render();
   }catch{if(!destroyed)note.textContent='Account sign in is unavailable. '+(customer?'Sign in again if your session expires.':'You can continue as a guest.');}
   finally{loading=null;}
  })();return loading;
 };
 button.addEventListener('click',async()=>{
  if(sending||customer||!enabled)return;
  clearFieldError(email);if(!email.value.trim()||!email.checkValidity()){fieldError(email,'Enter a valid email address to receive a sign in link.');return;}
  sending=true;render();note.textContent='Sending your sign in link…';
  try{const result=await api('/customer/auth/request',{method:'POST',body:{email:email.value.trim()}});if(!destroyed)note.textContent=result.message+' Open the link, then return here to finish your order.';}
  catch(error){if(!destroyed)note.textContent=error.message||'Unable to send a sign in link. Please try again.';}
  finally{sending=false;if(!destroyed)render();}
 },{signal:events.signal});
 const resume=()=>{if(!doc.hidden&&form.isConnected&&!form.hidden&&canRefresh())void refresh();};
 win.addEventListener('focus',resume,{signal:events.signal});doc.addEventListener('visibilitychange',resume,{signal:events.signal});
 return {refresh,destroy(){destroyed=true;events.abort();}};
}
