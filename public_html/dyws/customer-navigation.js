/** Refresh verified session navigation when returning from another sign in tab. */
export function mountCustomerNavigation({root,api,window:win=root.ownerDocument?.defaultView||globalThis.window}){
 const doc=root.ownerDocument||root;let pending=null,destroyed=false;
 async function refresh(){
  if(destroyed)return;
  if(pending)return pending;
  pending=(async()=>{
   try{
    const {customer}=await api('/customer/session',{customer:true});if(destroyed)return;
    for(const link of root.querySelectorAll('[data-dyws-customer-link]')){
     link.textContent=customer?'My account':'Sign in';
     link.href=customer?link.dataset.accountUrl:link.dataset.signinUrl;
    }
   }catch{/* Keep the server rendered session state when a refresh is unavailable. */}
   finally{pending=null;}
  })();return pending;
 }
 const resume=()=>{if(!doc.hidden)void refresh();};
 win.addEventListener('focus',resume);win.addEventListener('pageshow',resume);doc.addEventListener('visibilitychange',resume);
 void refresh();
 return {refresh,destroy(){destroyed=true;win.removeEventListener('focus',resume);win.removeEventListener('pageshow',resume);doc.removeEventListener('visibilitychange',resume);}};
}
