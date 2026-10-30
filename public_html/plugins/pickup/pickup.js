import {escapeHTML as esc} from '../../dyws/api.js';
import {localParts} from '../../dyws/fulfillment.js';
import {fieldError,clearFieldError} from '../../dyws/checkout-fields.js';

/** Starting addresses stay in page memory. Availability and final validation use the server clock. */
export function mountPickup({form,catalog,selectedLocation,plugins,api}){
 const doc=form.ownerDocument,root=doc.createElement('fieldset'),zone=catalog.timeZone||'America/Edmonton';
 root.className='dyws-pickup-tools';root.innerHTML=`<legend class="dyws-visually-hidden">Pickup</legend><label class="dyws-option-toggle"><input type="checkbox" name="schedulePickup" aria-controls="dyws-pickup-time" aria-expanded="false"> Schedule pickup</label><div id="dyws-pickup-time" role="group" aria-label="Pickup time in ${esc(zone)}" hidden><label>Date<input type="date" name="pickupDate"></label><div class="dyws-pickup-clock"><label>Hour<select name="pickupHour"><option value="">Hour</option>${Array.from({length:24},(_,h)=>`<option value="${String(h).padStart(2,'0')}">${h%12||12} ${h<12?'AM':'PM'}</option>`).join('')}</select></label><label>Minutes<select name="pickupMinute"><option value="">Minutes</option>${['00','15','30','45'].map(m=>`<option value="${m}">${m}</option>`).join('')}</select></label></div><p class="dyws-note dyws-slot-status" role="status"></p></div><button type="button" class="dyws-directions-toggle dyws-muted" aria-controls="dyws-directions" aria-expanded="false">Directions</button><div id="dyws-directions" hidden><label>From<input name="pickupOrigin" maxlength="240" autocomplete="off"></label><div data-pickup-map></div><a data-pickup-directions target="_blank" rel="noopener noreferrer">Open Google Maps ↗</a></div>`;
 form.querySelector('[data-dyws-order-field="total"]').prepend(root);
 const f=form.elements,when=root.querySelector('#dyws-pickup-time'),host=root.querySelector('[data-pickup-map]'),link=root.querySelector('[data-pickup-directions]'),status=root.querySelector('.dyws-slot-status');
 let view,timer,signature='',destroyed=false,request=0,pending,slotKey='',slots=[],failure='',loading=false;
 const enabled=()=>f.fulfillment.value==='pickup'&&f.schedulePickup.checked;
 function preview(){
  const location=selectedLocation(),origin=f.pickupOrigin.value.trim(),destination=location?.address||'',active=f.fulfillment.value==='pickup'&&!root.querySelector('#dyws-directions').hidden;
  const next=JSON.stringify([active,origin,destination,location?.name]);if(next===signature)return;clearTimeout(timer);signature=next;view?.clear?.();
  const query=new URLSearchParams({api:'1',destination:destination||location?.name||'',travelmode:'driving'});if(origin)query.set('origin',origin);
  link.href='https://www.google.com/maps/dir/?'+query;link.hidden=!active||!location;
  if(active&&origin&&destination)timer=setTimeout(()=>{if(!destroyed)void view?.update({origin,destination,name:location.name});},700);
 }
 root.querySelector('.dyws-directions-toggle').onclick=event=>{
  const panel=root.querySelector('#dyws-directions');panel.hidden=!panel.hidden;event.currentTarget.setAttribute('aria-expanded',String(!panel.hidden));
  if(!panel.hidden&&!view){view=plugins?.createPickupMap?.({document:doc});if(view?.element)host.append(view.element);}
  preview();if(!panel.hidden)f.pickupOrigin.focus();
 };
 function choices(){
  const hours=new Set(slots.map(slot=>slot.time.slice(0,2)));
  for(const option of f.pickupHour.options)option.disabled=!hours.has(option.value);
  if(!hours.has(f.pickupHour.value))f.pickupHour.value=slots[0]?.time.slice(0,2)||'';
  const minutes=slots.filter(slot=>slot.time.startsWith(f.pickupHour.value+':')).map(slot=>slot.time.slice(3));
  for(const option of f.pickupMinute.options)option.disabled=!minutes.includes(option.value);
  if(!minutes.includes(f.pickupMinute.value))f.pickupMinute.value=minutes[0]||'';
 }
 async function refresh(){
  const key=JSON.stringify([selectedLocation()?.id||'',f.pickupDate.value]);
  if(key===slotKey)return pending;slotKey=key;const generation=++request;
  loading=true;failure='';status.textContent='Finding times…';f.pickupHour.disabled=true;f.pickupMinute.disabled=true;
  pending=(async()=>{
   try{
    if(!api)throw new Error('Scheduled pickup is unavailable.');
    const result=await api('/pickup/availability',{method:'POST',body:{locationId:selectedLocation()?.id||'',...(f.pickupDate.value?{date:f.pickupDate.value}:{})}});
    if(destroyed||generation!==request)return;
    f.pickupDate.min=result.minDate;f.pickupDate.value=result.date;slots=result.slots;
    slotKey=JSON.stringify([selectedLocation()?.id||'',f.pickupDate.value]);choices();
    status.textContent=slots.length?'':'No pickup times. Choose another date.';clearFieldError(f.pickupDate);
   }catch(error){if(destroyed||generation!==request)return;slots=[];choices();failure=error.message||'Unable to load pickup times.';status.textContent=failure;slotKey='';}
   finally{if(!destroyed&&generation===request){loading=false;f.pickupHour.disabled=!enabled();f.pickupMinute.disabled=!enabled();}}
  })();return pending;
 }
 function sync(){
  const pickup=f.fulfillment.value==='pickup',scheduled=enabled();root.hidden=!pickup;root.disabled=!pickup;when.hidden=!scheduled;
  f.schedulePickup.setAttribute('aria-expanded',String(scheduled));
  for(const name of ['pickupDate','pickupHour','pickupMinute']){f[name].disabled=!scheduled||(loading&&name!=='pickupDate');f[name].required=scheduled;}
  f.pickupDate.min=localParts(Date.now(),zone).date;if(scheduled)void refresh();preview();
 }
 f.schedulePickup.onchange=()=>{if(f.schedulePickup.checked)slotKey='';sync();if(f.schedulePickup.checked)f.pickupDate.focus();};
 f.pickupDate.onchange=()=>{void refresh();};f.pickupHour.onchange=choices;
 f.pickupOrigin.addEventListener('input',preview);f.pickupOrigin.addEventListener('change',preview);
 return {sync,async read(){
  if(!enabled())return {};
  await pending;
  const pickupSchedule={date:f.pickupDate.value,time:f.pickupHour.value+':'+f.pickupMinute.value};
  try{
   if(failure)throw new Error(failure);
   if(!slots.some(slot=>slot.time===pickupSchedule.time))throw new Error('Choose an available pickup time.');
   const fulfillmentMeta=await api('/pickup/preview',{method:'POST',body:{pickupSchedule,locationId:selectedLocation()?.id||''}});
   return {pickupSchedule,fulfillmentMeta};
  }catch(error){fieldError(f.pickupDate,error.message);slotKey='';void refresh();throw error;}
 },destroy(){destroyed=true;request++;clearTimeout(timer);view?.destroy?.();f.pickupOrigin.removeEventListener('input',preview);f.pickupOrigin.removeEventListener('change',preview);}};
}
