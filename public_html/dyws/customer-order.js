/** A tracking capability can be claimed only by a verified customer session. */
export async function mountCustomerOrder({root,api,accountURL,id,token}){
 if(!accountURL)return;
 const call=(route,options={})=>api(route,{...options,customer:true});
 try{
  const state=await call('/customer/session');if(!state.enabled||!root.isConnected)return;
  const button=root.ownerDocument.createElement('button'),note=root.ownerDocument.createElement('p');button.type='button';button.textContent='Save order to my account';note.setAttribute('role','status');
  const link=root.ownerDocument.createElement('a'),signinURL=new URL('sign-in/',accountURL).href;link.dataset.dywsCustomerLink='';link.dataset.accountUrl=accountURL;link.dataset.signinUrl=signinURL;link.href=state.customer?accountURL:signinURL;link.target='_blank';link.rel='noopener noreferrer';link.textContent=state.customer?'My account':'Sign in';
  root.append(button,note,link);
  button.onclick=async()=>{
   button.disabled=true;note.textContent='';
   try{
    const current=await call('/customer/session');
    if(!current.customer){note.textContent='Select Sign in, then return here and select Save order to my account.';return;}
    await call('/customer/orders/'+id+'/claim',{method:'POST',trackingToken:token,body:{}});
    note.textContent='Order saved. Open My account to view it or report and block the driver after delivery.';
   }catch(e){note.textContent=e.message;}finally{button.disabled=false;}
  };
 }catch{ /* Tracking remains usable while customer accounts are unavailable. */ }
}
