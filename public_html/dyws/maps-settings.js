import {adminPage} from './admin-navigation.js';
export async function mountMapsSettings({root=document,api,storageKey}){
 const page=adminPage({root,api,storageKey});if(!page.token)return;
 const form=root.querySelector('#maps-form'),message=root.querySelector('#maps-message');let revision;
 function display(data){revision=data.revision;form.elements.enabled.checked=data.enabled;form.elements.browserKey.value='';form.elements.browserKey.placeholder=data.hasKey?'Key saved. Leave blank to keep it.':'Google Maps browser key';form.elements.mapId.value=data.mapId;form.querySelector('fieldset').disabled=false;}
 async function reload(){display(await page.request('/manager/maps'));message.textContent='Maps settings loaded.';}
 root.querySelector('#reload-maps').onclick=e=>page.action(e.currentTarget,reload);
 form.onsubmit=e=>{e.preventDefault();page.action(e.submitter,async()=>{display(await page.request('/manager/maps',{method:'POST',body:{revision,enabled:form.elements.enabled.checked,browserKey:form.elements.browserKey.value.trim(),mapId:form.elements.mapId.value.trim()}}));message.textContent='Maps settings saved. Reload the dashboard or order page to apply them.';});};
 try{await reload();}catch(e){page.error.textContent=e.message;}
}
