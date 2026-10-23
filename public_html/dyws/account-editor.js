import {escapeHTML as esc} from './api.js';
import {defaultRole} from './role-labels.js';
import {adminPage} from './admin-navigation.js';
export async function mountDriverAdmin({root=document,api,storageKey,role=defaultRole}) {
 const page=adminPage({root,api,storageKey});if(!page.token)return;
 const form=root.querySelector('#driver-form'),list=root.querySelector('#drivers-list'),message=root.querySelector('#driver-message');let revision,drivers=[];
 function edit(driver){form.reset();form.elements.id.readOnly=!!driver;form.elements.id.value=driver?.id||'';form.elements.name.value=driver?.name||'';form.elements.active.checked=driver?.active??true;form.elements.password.required=!driver;root.querySelector('#driver-form-title').textContent=(driver?'Edit ':'Add ')+role.singular;form.elements.name.focus();}
 function display(data){revision=data.revision;drivers=data.drivers;list.innerHTML=drivers.length?drivers.map((d,i)=>`<article class="dyws-driver-card"><div><h3>${esc(d.name)}</h3><p>${esc(d.id)} · ${d.active?'Active':'Inactive'}</p><p>${d.activeOrders} active orders</p></div><button type="button" data-edit="${i}">Edit ${esc(role.singular)}</button></article>`).join(''):`<p>No ${esc(role.plural)} yet. Add your first ${esc(role.singular)} below.</p>`;}
 list.onclick=event=>{const button=event.target.closest('[data-edit]');if(button)edit(drivers[Number(button.dataset.edit)]);};
 root.querySelector('#new-driver').onclick=()=>edit();
 root.querySelector('#reload-drivers').onclick=event=>page.action(event.target,async()=>{display(await page.request('/manager/drivers'));message.textContent=role.plural+' reloaded.';});
 form.onsubmit=event=>{event.preventDefault();page.action(event.submitter,async()=>{const body={create:!form.elements.id.readOnly,id:form.elements.id.value.trim(),name:form.elements.name.value.trim(),active:form.elements.active.checked,password:form.elements.password.value,revision};const data=await page.request('/manager/drivers',{method:'POST',body});display(data);edit(drivers.find(d=>d.id===body.id));message.textContent=role.singular+' saved. Password resets and deactivation sign this account out.';});};
 try{display(await page.request('/manager/drivers'));edit();}catch(e){page.error.textContent=e.message;}
}
export function mountPasswordAdmin({root=document,api,storageKey}) {
 const page=adminPage({root,api,storageKey});if(!page.token)return;
 const form=root.querySelector('#password-form'),message=root.querySelector('#password-message');
 form.onsubmit=event=>{event.preventDefault();page.action(event.submitter,async()=>{const body=Object.fromEntries(new FormData(form));if(body.newPassword!==body.confirmPassword)throw new Error('The new passwords do not match.');await page.request('/manager/password',{method:'POST',body});form.reset();page.signOut();message.textContent='Password changed. Sign in again with your new password.';});};
}
