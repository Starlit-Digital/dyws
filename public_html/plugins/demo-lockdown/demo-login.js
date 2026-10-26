import {orderSelectionURL,readOrderSelection,validOrderId} from '../../dyws/order-selection.js';
/** Use the existing protected browser form, including its CSRF cookie and token. */
export async function signInDemo(role,{document:doc=globalThis.document,request=globalThis.fetch,parse=html=>new DOMParser().parseFromString(html,'text/html'),navigate=url=>doc.defaultView.location.assign(url),baseURL=new URL('../../',import.meta.url),orderId=null}={}){
 if(!['admin','driver'].includes(role))throw new Error('Choose the Admin or Driver demo.');
 const account={admin:{path:'auth/',destination:'orders/',field:'username'},driver:{path:'driver/',destination:'driver/',field:'driverId'}}[role];
 if(!account)throw new Error('Choose the Admin or Driver demo.');
 const target=new URL(account.path,baseURL),destination=new URL(account.destination,baseURL);
 const response=await request(target.href,{credentials:'same-origin',mode:'same-origin',cache:'no-store'});
 if(!response.ok||![target.href,destination.href].includes(response.url))throw new Error('Demo sign in is temporarily unavailable.');
 if(role==='admin'&&response.url===destination.href){navigate(orderSelectionURL(destination,orderId));return;}
 const page=parse(await response.text());
 if(role==='driver'&&page.querySelector('#driver-board:not([hidden])')){navigate(orderSelectionURL(destination,orderId));return;}
 const csrf=page.querySelector('form input[name="csrf"]')?.value;
 if(!/^[a-f0-9]{64}$/.test(csrf||''))throw new Error('The sign in form could not be loaded.');
 // Browsers retain this fragment through the normal 303 login redirect.
 const form=doc.createElement('form');form.method='post';form.action=orderSelectionURL(target,orderId);form.hidden=true;
 for(const [name,value]of Object.entries({csrf,[account.field]:role,password:role})){
  const input=doc.createElement('input');input.type='hidden';input.name=name;input.value=value;form.append(input);
 }
 doc.body.append(form);
 try{form.submit();}catch(error){form.remove();throw error;}
}

/** Shareable entry links and console shortcuts, available only in the active demo plugin. */
export function createDemoAccess({document:doc,signIn=signInDemo,baseURL=new URL('../../',import.meta.url)}){
 let signingIn=false;
 const entries=new Map();
 function link(role,label,orderId=null){
  if(!['admin','driver'].includes(role))throw new Error('Choose the Admin or Driver demo.');
  const box=doc.createElement('div'),anchor=doc.createElement('a'),feedback=doc.createElement('p');
  box.className='dyws-demo-access';anchor.className='dyws-demo-shortcut';
  const url=new URL(baseURL);url.searchParams.set('demo',role);anchor.href=orderSelectionURL(url,orderId);anchor.textContent=label;
  feedback.className='dyws-demo-login-status';feedback.setAttribute('role','status');feedback.hidden=true;
  let selectedOrderId=validOrderId(orderId);
  const start=async(selectedOrder=selectedOrderId)=>{
   if(signingIn)return;signingIn=true;anchor.setAttribute('aria-disabled','true');
   selectedOrderId=validOrderId(selectedOrder);anchor.href=orderSelectionURL(url,selectedOrderId);
   feedback.textContent='Signing in to the '+(role==='admin'?'Admin':'Driver')+' demo…';feedback.hidden=false;
   try{await signIn(role,{document:doc,baseURL,orderId:selectedOrderId});}catch{
    signingIn=false;anchor.removeAttribute('aria-disabled');feedback.textContent='Automatic sign in is unavailable. ';
    const fallback=doc.createElement('a');fallback.href=new URL(role==='admin'?'auth/':'driver/',baseURL).href;fallback.textContent='Use the standard sign in';feedback.replaceChildren(feedback.textContent,fallback);
   }
  };
  anchor.addEventListener('click',event=>{
   if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
   event.preventDefault();return start();
  });
  box.append(anchor,feedback);if(!entries.has(role))entries.set(role,start);return box;
 }
 function enterFromURL(){
  const view=doc.defaultView;if(!view)return;
  const url=new URL(view.location.href),role=url.searchParams.get('demo');
  if(!entries.has(role))return;
  // Consume the entry request so Back and Reload do not trigger another sign in.
  url.searchParams.delete('demo');view.history.replaceState(view.history.state,'',url.href);
  return entries.get(role)(readOrderSelection(url.href));
 }
 return {link,enterFromURL};
}
