import {escapeHTML as esc} from './api.js';
import {localParts} from './fulfillment.js';

/** Page memory only. Starting addresses are never included in the order or guest profile. */
export function mountPickup({form,catalog,selectedLocation,plugins,api}){
 const doc=form.ownerDocument,root=doc.createElement('fieldset'),zone=catalog.timeZone||'America/Edmonton';
 root.className='dyws-pickup-tools';root.innerHTML=`<legend class="dyws-visually-hidden">Pickup</legend><label class="dyws-option-toggle"><input type="checkbox" name="schedulePickup" aria-controls="dyws-pickup-time" aria-expanded="false"> Schedule pickup</label><div id="dyws-pickup-time" role="group" aria-label="Pickup time in ${esc(zone)}" hidden><label>Date<input type="date" name="pickupDate"></label><div class="dyws-pickup-clock"><label>Hour<select name="pickupHour"><option value="">Hour</option>${Array.from({length:24},(_,h)=>`<option value="${String(h).padStart(2,'0')}">${h%12||12} ${h<12?'AM':'PM'}</option>`).join('')}</select></label><label>Minutes<select name="pickupMinute"><option value="">Minutes</option>${['00','15','30','45'].map(m=>`<option value="${m}">${m}</option>`).join('')}</select></label></div></div><label>From (optional)<input name="pickupOrigin" maxlength="240" autocomplete="off"></label><div data-pickup-map></div><a data-pickup-directions target="_blank" rel="noopener noreferrer">Google Maps ↗</a>`;
 form.querySelector('[data-dyws-order-field="total"]').prepend(root);
 const f=form.elements,when=root.querySelector('#dyws-pickup-time'),host=root.querySelector('[data-pickup-map]'),link=root.querySelector('[data-pickup-directions]');
 const view=plugins?.createPickupMap?.({document:doc});if(view?.element)host.append(view.element);
 let timer,signature='',destroyed=false;
 function preview(){
  const location=selectedLocation(),origin=f.pickupOrigin.value.trim(),destination=location?.address||'',active=f.fulfillment.value==='pickup';
  const next=JSON.stringify([active,origin,destination,location?.name]);if(next===signature)return;clearTimeout(timer);signature=next;view?.clear?.();
  const query=new URLSearchParams({api:'1',destination:destination||location?.name||'',travelmode:'driving'});if(origin)query.set('origin',origin);
  link.href='https://www.google.com/maps/dir/?'+query;link.hidden=!active||!location;
  if(active&&origin&&destination)timer=setTimeout(()=>{if(!destroyed)void view?.update({origin,destination,name:location.name});},700);
 }
 function sync(){
  const pickup=f.fulfillment.value==='pickup',enabled=pickup&&f.schedulePickup.checked;root.hidden=!pickup;root.disabled=!pickup;when.hidden=!enabled;
  f.schedulePickup.setAttribute('aria-expanded',String(enabled));
  for(const name of ['pickupDate','pickupHour','pickupMinute']){f[name].disabled=!enabled;f[name].required=enabled;}
  f.pickupDate.min=localParts(Date.now(),zone).date;preview();
 }
 f.schedulePickup.onchange=()=>{
  if(f.schedulePickup.checked&&!f.pickupDate.value){const initial=localParts(Math.ceil((Date.now()+1860000)/900000)*900000,zone);f.pickupDate.value=initial.date;[f.pickupHour.value,f.pickupMinute.value]=initial.time.split(':');}
  sync();if(f.schedulePickup.checked)f.pickupDate.focus();
 };
 f.pickupOrigin.addEventListener('input',preview);f.pickupOrigin.addEventListener('change',preview);
 return {sync,async read(){
  if(f.fulfillment.value!=='pickup'||!f.schedulePickup.checked)return {};
  const pickupSchedule={date:f.pickupDate.value,time:f.pickupHour.value+':'+f.pickupMinute.value};
  if(!api)throw new Error('Scheduled pickup is unavailable. Please contact the business.');
  const fulfillmentMeta=await api('/pickup/preview',{method:'POST',body:{pickupSchedule,locationId:selectedLocation()?.id||''}});
  return {pickupSchedule,fulfillmentMeta};
 },destroy(){destroyed=true;clearTimeout(timer);view?.destroy?.();f.pickupOrigin.removeEventListener('input',preview);f.pickupOrigin.removeEventListener('change',preview);}};
}
