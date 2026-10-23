export function mountAdminNavigation({root=document,current,pages}) {
 const nav=root.querySelector('[data-dyws-admin-nav]');if(!nav)return;
 nav.classList.add('dyws-admin-tabs');nav.setAttribute('aria-label','Administration');
 if(!Array.isArray(pages))throw new TypeError('Provide the admin page links.');
 nav.replaceChildren(...pages.map(([key,name,url])=>{const link=document.createElement('a');link.href=url;link.textContent=name;if(key===current)link.setAttribute('aria-current','page');return link;}));
}
export function adminPage({root=document,api,storageKey='starlit-go-manager'}) {
 const token=sessionStorage.getItem(storageKey),content=root.querySelector('[data-admin-content]'),login=root.querySelector('[data-admin-login]'),error=root.querySelector('[data-admin-error]');
 const signOut=()=>{sessionStorage.removeItem(storageKey);if(content)content.hidden=true;if(login)login.hidden=false;};
 if(!token)signOut();else{if(content)content.hidden=false;if(login)login.hidden=true;}
 const request=async(route,options={})=>{try{return await api(route,{...options,token});}catch(e){if(e.status===401)signOut();throw e;}};
 const action=async(button,fn)=>{button.disabled=true;error.textContent='';try{await fn();}catch(e){error.textContent=e.message;}finally{button.disabled=false;}};
 return {token,request,action,error,signOut};
}
