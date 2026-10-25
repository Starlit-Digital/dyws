import {driverIcons,driverIcon} from './driver-icons.js';
import {vehicleColors} from './vehicle-colors.js';

/** A driver's own display details, independent of delivery and account permissions. */
export function mountDriverProfile({root,api,getToken,onSaved=()=>{}}){
 if(!root)return null;
 root.innerHTML=`<summary>My profile</summary><form><div class="dyws-driver-profile-heading"><img data-profile-preview width="48" height="56" alt=""><div><h2 data-profile-name></h2><p class="dyws-note">Help customers recognise you and your vehicle.</p></div></div><fieldset data-profile-fields disabled><legend class="dyws-visually-hidden">Vehicle profile</legend><div class="dyws-driver-vehicle-fields"><label>Vehicle model<input name="vehicleType" maxlength="60" placeholder="Toyota Corolla" autocomplete="off"></label><fieldset><legend>Vehicle colour</legend><div class="dyws-vehicle-colors">${vehicleColors.map(color=>`<label class="dyws-vehicle-color-choice" title="${color.name}"><input type="radio" name="vehicleColor" value="${color.name}" aria-label="${color.name}"><span style="background-color:${color.hex}" aria-hidden="true"></span></label>`).join('')}</div><div class="dyws-vehicle-color-caption"><span data-profile-color-name role="status" aria-live="polite"></span><button type="button" data-profile-clear-color class="dyws-secondary">Clear colour</button></div></fieldset></div><fieldset><legend>Driver icon</legend><div class="dyws-driver-icon-choices">${driverIcons.map(icon=>`<label class="dyws-driver-icon-choice"><input type="radio" name="profileIcon" value="${icon.id}" required><span><img src="${icon.url}" width="48" height="56" alt=""><strong>${icon.label}</strong>${icon.id==='car'?'<small>Default</small>':'<small aria-hidden="true">&nbsp;</small>'}</span></label>`).join('')}</div></fieldset><div class="dyws-actions"><button type="submit">Save profile</button><button type="button" data-profile-reload class="dyws-secondary">Reload profile</button></div></fieldset><p data-profile-message role="status" aria-live="polite"></p></form>`;
 const form=root.querySelector('form'),fields=form.querySelector('[data-profile-fields]'),message=form.querySelector('[data-profile-message]'),preview=form.querySelector('[data-profile-preview]'),colorName=form.querySelector('[data-profile-color-name]');
 let profile,dirty=false,saving=false,selectedColor='';
 function showColor(){
  for(const radio of form.querySelectorAll('[name=vehicleColor]'))radio.checked=radio.value===selectedColor;
  colorName.textContent=selectedColor?`Selected: ${selectedColor}`:'No colour selected';
  form.querySelector('[data-profile-clear-color]').disabled=!selectedColor;
 }
 function sync(data,force=false){
  if(!data||(!force&&(dirty||saving)))return;
  profile=data;root.hidden=false;root.querySelector('[data-profile-name]').textContent=data.name;
  form.elements.profileIcon.value=driverIcon(data.profileIcon).id;preview.src=driverIcon(data.profileIcon).url;
  form.elements.vehicleType.value=data.vehicleType||'';selectedColor=data.vehicleColor||'';showColor();fields.disabled=false;dirty=false;
 }
 function changed(event){dirty=true;if(event.target.name==='vehicleColor'){selectedColor=event.target.value;showColor();}preview.src=driverIcon(form.elements.profileIcon.value).url;message.textContent='Unsaved changes';}
 form.oninput=changed;form.onchange=changed;
 form.querySelector('[data-profile-clear-color]').onclick=()=>{selectedColor='';showColor();dirty=true;message.textContent='Unsaved changes';};
 form.onsubmit=async event=>{
  event.preventDefault();if(saving||!profile)return;saving=true;fields.disabled=true;message.textContent='Saving…';
  try{const data=await api('/driver/profile',{method:'POST',token:getToken(),body:{profileIcon:form.elements.profileIcon.value,vehicleType:form.elements.vehicleType.value.trim(),vehicleColor:selectedColor,revision:profile.revision}});sync(data,true);message.textContent='Profile saved.';onSaved(data);}
  catch(error){message.textContent=error.message;}finally{saving=false;fields.disabled=false;}
 };
 form.querySelector('[data-profile-reload]').onclick=async()=>{if(saving)return;saving=true;fields.disabled=true;try{sync(await api('/driver/profile',{token:getToken()}),true);message.textContent='Profile reloaded.';}catch(error){message.textContent=error.message;}finally{saving=false;fields.disabled=false;}};
 return {sync,clear(){profile=null;dirty=false;root.hidden=true;message.textContent='';}};
}
