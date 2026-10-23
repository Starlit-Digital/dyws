import {adminPage} from './admin-navigation.js';
import {escapeHTML as esc} from './api.js';
export async function mountPluginAdmin({root=document,api}){
 const page=adminPage({root,api});if(!page.token)return;
 const list=root.querySelector('[data-dyws-plugins]'),message=root.querySelector('[data-dyws-plugin-message]');let revision;
 function display(data){
  revision=data.revision;
  list.innerHTML=data.plugins.map(p=>`<article><div class="dyws-editor-heading"><div><h2>${esc(p.name)}</h2><p>${esc(p.description)}</p><p class="dyws-note">${esc(p.version)} · ${p.active?'Active':'Inactive'}</p></div><button type="button" data-plugin="${esc(p.id)}" data-active="${!p.active}" ${p.error&&!p.active?'disabled':''}>${p.active?'Deactivate':'Activate'}</button></div>${p.error?`<p class="dyws-error">${esc(p.error)}</p>`:''}</article>`).join('')||'<p>No plugins installed.</p>';
  if(data.warning)message.textContent=data.warning;
  list.querySelectorAll('[data-plugin]').forEach(button=>{button.onclick=()=>page.action(button,async()=>{const active=button.dataset.active==='true';const result=await page.request('/manager/plugins',{method:'POST',body:{id:button.dataset.plugin,active,revision}});display(result);message.textContent=(active?'Activated.':'Deactivated.')+' Refresh other open pages to apply. Settings are kept.';});});
 }
 const reload=async()=>{message.textContent='';display(await page.request('/manager/plugins'));};
 root.querySelector('[data-dyws-reload-plugins]').onclick=e=>page.action(e.currentTarget,reload);
 try{await reload();}catch(e){page.error.textContent=e.message;}
}
