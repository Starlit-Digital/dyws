import {pluginTypes,pluginsOfType} from './plugin-types.js';
import {statusBadge} from './status-badge.js';
import {adminPage} from './admin-navigation.js?v=39';
import {escapeHTML as esc} from './api.js';
export async function mountPluginAdmin({root=document,api}){
 const page=adminPage({root,api});if(!page.token)return;
 const list=root.querySelector('[data-dyws-plugins]'),message=root.querySelector('[data-dyws-plugin-message]');let revision,refresh,latest,selectedType='all';
 function display(data){latest=data;
  revision=data.revision;
  const available=pluginTypes.filter(([id])=>id==='all'||pluginsOfType(data.plugins,id).length);
  if(!available.some(([id])=>id===selectedType))selectedType='all';
  list.innerHTML=`<div class="dyws-plugin-browser"><div class="dyws-plugin-types" role="tablist" aria-label="Plugin types" aria-orientation="vertical">${available.map(([id,label])=>`<button type="button" role="tab" id="plugin-type-${id}" aria-controls="plugin-type-panel" aria-selected="${id===selectedType}" tabindex="${id===selectedType?0:-1}" data-plugin-type="${id}"><span>${esc(label)}</span><span>${pluginsOfType(data.plugins,id).length}</span></button>`).join('')}</div><div id="plugin-type-panel" role="tabpanel" tabindex="0" aria-labelledby="plugin-type-${selectedType}">${pluginsOfType(data.plugins,selectedType).map(p=>`<article><div class="dyws-editor-heading"><div><h2>${esc(p.name)}</h2><p>${esc(p.description)}</p><p class="dyws-status-row">${statusBadge(p.active?'enabled':'disabled')}${p.locked?statusBadge('locked'):''}<span class="dyws-note">${esc(p.version)}</span></p></div><div class="dyws-plugin-controls"><button type="button" class="${p.active?'dyws-secondary':''}" data-plugin="${esc(p.id)}" data-active="${!p.active}" ${p.locked||(p.error&&!p.active)?'disabled':''}>${p.locked?'Locked':p.active?'Deactivate':'Activate'}</button><a class="dyws-link-button dyws-secondary" href="${new URL('../plugins/edit.php',import.meta.url).href}?plugin=${encodeURIComponent(p.id)}">Edit</a></div></div>${p.connection?`<p class="dyws-note">${p.connection.configured?'Credentials saved':'Credentials needed'} · ${p.connection.verifiedAt?'Connection checked':'Connection not checked'} · Connector foundation</p>`:''}${p.retainsWebhooks?'<p class="dyws-note">Saved settings are retained. Signed event callbacks remain available while inactive.</p>':''}${p.error?`<p class="dyws-error">${esc(p.error)}</p>`:''}</article>`).join('')||'<p>No plugins installed.</p>'}</div></div>`;
  for(const tab of list.querySelectorAll('[data-plugin-type]')){tab.onclick=()=>{selectedType=tab.dataset.pluginType;display(latest);list.querySelector('[data-plugin-type="'+selectedType+'"]').focus();};tab.onkeydown=e=>{const keys=['ArrowDown','ArrowUp','Home','End'];if(!keys.includes(e.key))return;e.preventDefault();const index=available.findIndex(([id])=>id===selectedType);const next=e.key==='Home'?0:e.key==='End'?available.length-1:(index+(e.key==='ArrowDown'?1:-1)+available.length)%available.length;selectedType=available[next][0];display(latest);list.querySelector('[data-plugin-type="'+selectedType+'"]').focus();};}
  refresh?.reset(data);
  if(data.warning)message.textContent=data.warning;
  list.querySelectorAll('[data-plugin]').forEach(button=>{button.onclick=()=>page.action(button,async()=>{const active=button.dataset.active==='true';const result=await page.request('/manager/plugins',{method:'POST',body:{id:button.dataset.plugin,active,revision}});display(result);message.textContent=(active?'Activated.':'Deactivated.')+' Refresh other open pages to apply. Settings are kept.';});});
 }
 const reload=async()=>{message.textContent='';display(await page.request('/manager/plugins'));};
 try{await reload();}catch(e){page.error.textContent=e.message;}
 refresh=page.autoRefresh({read:()=>page.request('/manager/plugins'),apply:display,initial:latest});
}
