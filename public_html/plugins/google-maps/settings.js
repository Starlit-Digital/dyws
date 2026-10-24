import {statusBadge} from '../../dyws/status-badge.js';
import {adminPage} from '../../dyws/admin-navigation.js?v=39';
export async function mountMapsSettings({root=document,api,storageKey}){
 const page=adminPage({root,api,storageKey});if(!page.token)return;
 const form=root.querySelector('#maps-form'),message=root.querySelector('#maps-message');let revision,refresh,latest;
 function display(data){latest=data;const state=root.querySelector('#maps-state');if(state)state.innerHTML=statusBadge(data.enabled?'enabled':'disabled')+statusBadge(data.hasKey?'enabled':'unpaid',data.hasKey?'API key saved':'API key needed');revision=data.revision;form.elements.enabled.checked=data.enabled;form.elements.browserKey.value='';form.elements.browserKey.placeholder=data.hasKey?'Key saved. Leave blank to keep it.':'Google Maps browser key';form.elements.mapId.value=data.mapId;form.querySelector('fieldset').disabled=false;refresh?.reset(data);}
 async function reload(){display(await page.request('/manager/plugins/google-maps/settings'));message.textContent='';}
 root.querySelector('#reload-maps').onclick=e=>page.action(e.currentTarget,reload);
 form.onsubmit=e=>{e.preventDefault();page.action(e.submitter,async()=>{display(await page.request('/manager/plugins/google-maps/settings',{method:'POST',body:{revision,enabled:form.elements.enabled.checked,browserKey:form.elements.browserKey.value.trim(),mapId:form.elements.mapId.value.trim()}}));message.textContent='Saved. Refresh other open pages to apply.';});};
 try{await reload();}catch(e){page.error.textContent=e.message;}
 refresh=page.autoRefresh({read:()=>page.request('/manager/plugins/google-maps/settings'),apply:display,forms:[form],initial:latest});
}
