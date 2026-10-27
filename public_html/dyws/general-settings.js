import {mountBusinessSettings} from './business-settings.js?v=52';
import {configureTimeZone} from './date-time.js';
import {adminPage} from './admin-navigation.js?v=39';
export async function mountGeneralSettings({root=document,api,storageKey,onSave=()=>{}}){
 const page=adminPage({root,api,storageKey});if(!page.token)return;
 const form=root.querySelector('#settings-form'),message=root.querySelector('#settings-message');
 const fields=form.querySelector('fieldset');let revision,refresh,latest;
 function display(data){latest=data;configureTimeZone(data.settings.timeZone);form.elements.timeZone.replaceChildren(...data.timeZones.map(zone=>{const option=document.createElement('option');option.value=zone;option.textContent=zone.replaceAll('_',' ');return option;}));form.elements.timeZone.value=data.settings.timeZone;revision=data.revision;form.elements.singular.value=data.settings.driverRole.singular;form.elements.plural.value=data.settings.driverRole.plural;fields.disabled=false;refresh?.reset(data);}
 async function reload(){const data=await page.request('/manager/settings');display(data);onSave(data.settings);message.textContent='';}
 root.querySelector('#reload-settings').onclick=e=>page.action(e.currentTarget,reload);
 form.onsubmit=e=>{e.preventDefault();page.action(e.submitter,async()=>{
  const data=await page.request('/manager/settings',{method:'POST',body:{revision,settings:{timeZone:form.elements.timeZone.value,driverRole:{singular:form.elements.singular.value,plural:form.elements.plural.value}}}});
  display(data);onSave(data.settings);message.textContent='Saved.';
 });};
 try{await Promise.all([reload(),mountBusinessSettings({root,page})]);}catch(e){page.error.textContent=e.message;}
 refresh=page.autoRefresh({read:()=>page.request('/manager/settings'),apply:data=>{display(data);onSave(data.settings);},forms:[form],initial:latest});
}
