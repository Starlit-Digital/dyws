import {redirectToAuth} from './admin-session.js?v=39';
export function mountAdminNavigation({root=document,current,pages}) {
 const nav=root.querySelector('[data-dyws-admin-nav]');if(!nav)return;
 nav.classList.add('dyws-admin-tabs');nav.setAttribute('aria-label','Administration');
 if(!Array.isArray(pages))throw new TypeError('Provide the admin page links.');
 // Update labels in place so polling doesn't steal keyboard focus.
 while(nav.children.length>pages.length)nav.lastElementChild.remove();
 while(nav.children.length<pages.length)nav.append(document.createElement('a'));
 pages.forEach(([key,name,url],index)=>{const link=nav.children[index];link.href=url;if(link.textContent!==name)link.textContent=name;if(key===current)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
 const title=pages.find(([key])=>key===current)?.[1];
 const pageTitle=root.querySelector('[data-dyws-page-title]');if(pageTitle&&pageTitle.textContent!==title)pageTitle.textContent=title;
 const menu=nav.closest('details');
 if(menu&&!menu.dataset.mounted){
  menu.dataset.mounted='true';const wide=matchMedia('(min-width: 1000px)');
  const adapt=()=>{menu.open=wide.matches;};adapt();wide.addEventListener('change',adapt);
  menu.addEventListener('keydown',event=>{if(event.key==='Escape'&&!wide.matches){menu.open=false;menu.querySelector('summary').focus();}});
  document.addEventListener('click',event=>{if(!wide.matches&&!menu.contains(event.target))menu.open=false;});
 }
}
export function adminPage({root=document,api,storageKey='dyws-manager'}) {
 const token=sessionStorage.getItem(storageKey),content=root.querySelector('[data-admin-content]'),error=root.querySelector('[data-admin-error]');
 const logout=root.querySelector('[data-admin-logout]');
 const signOut=()=>{sessionStorage.removeItem(storageKey);redirectToAuth(root);};
 if(!token)signOut();else if(content)content.hidden=false;
 if(logout){logout.hidden=!token;logout.onclick=async()=>{logout.disabled=true;try{await api('/logout',{method:'POST',body:{},token});}catch{}signOut();};}
 const request=async(route,options={})=>{try{return await api(route,{...options,token});}catch(e){if(e.status===401)signOut();throw e;}};
 const action=async(button,fn)=>{button.disabled=true;error.textContent='';try{await fn();}catch(e){error.textContent=e.message;}finally{button.disabled=false;}};
 return {token,request,action,error,signOut};
}
