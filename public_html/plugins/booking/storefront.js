import {formatPhoneField,formatPhoneInput} from '../../dyws/phone-input.js';
/** Host supplies API endpoint and root. Contact fields never enter browser storage. */
export async function mountBooking(root,{endpoint='api/'}={}){
 const doc=root.ownerDocument;let revision=0,requestKey=null,lastReceipt=null,requestFingerprint=null;
 const node=(tag,text)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const api=async(route,body)=>{const u=new URL(endpoint,doc.baseURI);u.searchParams.set('route',route);const r=await fetch(u,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,cache:'no-store',credentials:'same-origin'});const d=await r.json();if(!r.ok)throw Error(d.error||d.message||'Unable to complete this request. Please try again.');return d;};
 const status=node('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');root.append(status);
 try{
  const settings=await api('/plugins/booking/services');if(!settings.services.length){status.textContent='No appointments are available right now. Please try again later.';return;}const form=node('form');const service=node('select'),date=node('input'),slots=node('select');date.type='date';
  const zoneDate=new Intl.DateTimeFormat('en-CA',{timeZone:settings.timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());date.min=zoneDate;date.value=zoneDate;
  service.required=date.required=slots.required=true;
  const label=(text,input)=>{const l=node('label',text);l.append(input);form.append(l);};
  settings.services.forEach(s=>{const o=node('option',`${s.name}, ${s.duration} minutes`);o.value=s.id;service.append(o);});
  label('Service',service);label(`Date, ${settings.timeZone}`,date);label('Available time',slots);
  const name=node('input'),phone=node('input');name.required=phone.required=true;name.maxLength=100;phone.maxLength=30;phone.type='tel';phone.pattern='[0-9+() .-]{7,30}';name.autocomplete='name';phone.autocomplete='tel';phone.placeholder='(780) 555-0142';phone.addEventListener('input',formatPhoneField);
  if(settings.demo){name.value='Demo Customer';phone.value=formatPhoneInput('7805550142');name.readOnly=phone.readOnly=true;}
  label('Name',name);label('Phone',phone);
  const acknowledge=node('input');acknowledge.type='checkbox';acknowledge.required=true;label(settings.demo?'I understand this is a fictional demo appointment.':'I have reviewed the service, date and time.',acknowledge);
  const submit=node('button','Confirm appointment');submit.type='submit';form.append(submit);root.prepend(form);
  const load=async()=>{const version=++revision;submit.disabled=true;slots.replaceChildren();requestKey=null;status.textContent='Checking available times…';try{const data=await api('/plugins/booking/availability',{serviceId:service.value,date:date.value});if(version!==revision)return;for(const slot of data.slots){const o=node('option',slot.label);o.value=String(slot.startsAt);slots.append(o);}submit.disabled=!data.slots.length;status.textContent=data.slots.length?'Choose a time, then confirm your appointment.':'No available times on this date. Choose another date.';}catch(e){if(version===revision)status.textContent=e.message;}};
  service.onchange=date.onchange=load;slots.onchange=()=>{requestKey=null;};
  form.onsubmit=async event=>{event.preventDefault();if(!form.reportValidity())return;submit.disabled=true;const payload={serviceId:service.value,startsAt:Number(slots.value),customer:{name:name.value,phone:phone.value},acknowledged:acknowledge.checked};const fingerprint=JSON.stringify(payload);if(requestFingerprint!==fingerprint){requestFingerprint=fingerprint;requestKey=crypto.randomUUID();}requestKey??=crypto.randomUUID();status.textContent='Confirming your appointment…';try{const receipt=await api('/plugins/booking/reserve',{...payload,idempotencyKey:requestKey});lastReceipt=receipt;form.hidden=true;status.textContent=`${receipt.demo?'Demo appointment':'Appointment'} confirmed. Reference ${receipt.id}. ${new Intl.DateTimeFormat('en-CA',{dateStyle:'full',timeStyle:'short',timeZone:receipt.timeZone}).format(new Date(receipt.startsAt*1000))}.`;
   const cancel=node('button','Cancel this appointment');cancel.type='button';root.append(cancel);cancel.onclick=async()=>{cancel.disabled=true;try{await api('/plugins/booking/cancel',{id:lastReceipt.id,token:lastReceipt.cancellationToken});status.textContent='Your appointment is cancelled.';cancel.remove();}catch(e){status.textContent=e.message;cancel.disabled=false;}};
  }catch(e){status.textContent=e.message;submit.disabled=false;}};
  await load();
 }catch(e){status.textContent=e.message;}
}
