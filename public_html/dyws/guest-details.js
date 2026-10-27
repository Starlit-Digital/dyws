import {escapeHTML} from './api.js';

export function applySavedAddress(form,address){
 const details=address.addressDetails;
 for(const [key,name] of Object.entries({line1:'addressLine1',line2:'addressLine2',city:'addressCity',region:'addressRegion',postalCode:'addressPostal',country:'addressCountry'})){
  let input=form.elements.namedItem(name);
  if(!input){input=form.ownerDocument.createElement('input');input.type='hidden';input.name=name;form.append(input);}
  input.value=details[key]||'';
 }
 const street=form.elements.namedItem('addressLine1');
 if(form.dataset.dywsAddressAutocomplete!==undefined){
  street.value=[details.line1,details.city,details.region,details.postalCode].filter(Boolean).join(', ');
  street.dataset.dywsAddressLine1=details.line1;street.dataset.dywsAddressDisplay=street.value;
 }else{delete street.dataset.dywsAddressLine1;delete street.dataset.dywsAddressDisplay;}
}

export function rememberPreference(form){
 const input=form.elements.namedItem('rememberDetails');if(!input||input.disabled)return undefined;
 const field=name=>form.elements.namedItem(name)?.value||'';
 return {enabled:input.checked,profileId:field('savedProfileId'),addressId:field('savedAddressId'),label:field('addressLabel')==='custom'?field('customAddressLabel'):field('addressLabel'),default:!!form.elements.namedItem('defaultAddress')?.checked};
}

/** All customer data remains in this form's memory. Only the server sets the access cookie. */
export async function mountGuestDetails({form,api,termsURL,hasDraft=false,onForget=()=>{}}){
 if(!api||!termsURL)return null;
 const doc=form.ownerDocument,preferences=doc.createElement('section'),picker=doc.createElement('section');
 preferences.className='dyws-remember';picker.className='dyws-saved-addresses';picker.hidden=true;
 preferences.innerHTML=`<input type="hidden" name="savedProfileId"><label class="dyws-remember-check"><input type="checkbox" name="rememberDetails" disabled><span>Remember me on this device</span></label><p class="dyws-note"><a href="${escapeHTML(termsURL)}" target="_blank" rel="noopener noreferrer">Privacy &amp; terms<span class="dyws-visually-hidden">, opens in a new tab</span></a></p><div class="dyws-address-save" hidden><div class="dyws-checkout-grid"><label>Save as<select name="addressLabel"><option value="Home">Home</option><option value="Work">Work</option><option value="custom">Custom name</option></select></label><label class="dyws-custom-label" hidden>Address name<input name="customAddressLabel" maxlength="40" disabled></label></div><label class="dyws-remember-check"><input type="checkbox" name="defaultAddress"><span>Default address</span></label></div><button type="button" class="dyws-muted dyws-forget" hidden>Forget my details</button><p class="dyws-note dyws-guest-status" role="status" aria-live="polite"></p>`;
 picker.innerHTML='<label>Saved addresses<select name="savedAddressId"><option value="">New address</option></select></label><div class="dyws-saved-actions"><button type="button" class="dyws-muted dyws-remove-address" hidden>Remove address</button><button type="button" class="dyws-muted dyws-default-address" hidden>Make default</button></div>';
 form.prepend(picker);form.querySelector('.dyws-error').before(preferences);
 const field=name=>form.elements.namedItem(name),status=preferences.querySelector('.dyws-guest-status');
 const remember=field('rememberDetails'),labels=preferences.querySelector('.dyws-address-save'),custom=preferences.querySelector('.dyws-custom-label');
 const forget=preferences.querySelector('.dyws-forget'),remove=picker.querySelector('.dyws-remove-address'),makeDefault=picker.querySelector('.dyws-default-address');
 let state={profileId:null,addresses:[]},touched=false,pending=false;
 const touch=()=>{touched=true;};form.addEventListener('input',touch,{once:true});form.addEventListener('change',touch,{once:true});
 const sync=()=>{
  const saveAddress=remember.checked&&field('fulfillment').value==='delivery';labels.hidden=!saveAddress;
  field('addressLabel').disabled=!saveAddress;field('defaultAddress').disabled=!saveAddress;
  custom.hidden=field('addressLabel').value!=='custom';field('customAddressLabel').disabled=!saveAddress||custom.hidden;field('customAddressLabel').required=!field('customAddressLabel').disabled;
  const id=field('savedAddressId').value;remove.hidden=!id;makeDefault.hidden=!id||id===state.defaultAddressId;
 };
 const render=()=>{
  field('savedProfileId').value=state.profileId||'';forget.hidden=!state.profileId;picker.hidden=!state.addresses.length;
  field('savedAddressId').replaceChildren(new Option('New address',''),...state.addresses.map(a=>new Option(a.label+(a.id===state.defaultAddressId?' (default)':'')+' · '+[a.addressDetails.line1,a.addressDetails.line2].filter(Boolean).join(', '),a.id)));
 };
 const labelAddress=address=>{
  field('addressLabel').value=['Home','Work'].includes(address.label)?address.label:'custom';field('customAddressLabel').value=address.label;
  field('defaultAddress').checked=address.id===state.defaultAddressId;
 };
 const clearAddress=()=>{
  for(const name of ['addressLine1','addressLine2','addressCity','addressRegion','addressPostal','addressCountry']){const input=field(name);if(input&&!input.readOnly)input.value='';}
  const street=field('addressLine1');delete street.dataset.dywsAddressLine1;delete street.dataset.dywsAddressDisplay;
  field('savedAddressId').value='';field('addressLabel').value='Home';field('customAddressLabel').value='';field('defaultAddress').checked=false;
 };
 field('savedAddressId').addEventListener('change',()=>{
  const address=state.addresses.find(a=>a.id===field('savedAddressId').value);
  if(address){applySavedAddress(form,address);labelAddress(address);field('fulfillment').value='delivery';form.querySelector('.dyws-fulfillment').onchange();}
  else clearAddress();sync();
 });
 form.addEventListener('change',sync);
 const manage=async action=>{
  if(pending)return;pending=true;
  const selected=field('savedAddressId').value;
  // Prevent an order racing a removal from saving those same details again.
  const controls=[...form.querySelectorAll('button,input,select,textarea')].map(input=>[input,input.disabled]);controls.forEach(([input])=>input.disabled=true);
  try{
   state=await api('/guest-details',{method:'POST',body:{action,addressId:selected}});
   render();
   if(action==='forget'){
    for(const name of ['customer','phone'])if(!field(name).readOnly)field(name).value='';
    clearAddress();remember.checked=false;onForget();status.textContent='Saved details removed.';
   }else if(action==='remove'){clearAddress();onForget();status.textContent='Address removed.';}
   else{field('savedAddressId').value=selected;field('defaultAddress').checked=true;status.textContent='Default updated.';}
  }catch(error){status.textContent=error.message||'Could not update saved details. Please try again.';}
  finally{controls.forEach(([input,disabled])=>input.disabled=disabled);pending=false;sync();(action==='forget'?remember:field('savedAddressId')).focus();}
 };
 forget.onclick=()=>manage('forget');remove.onclick=()=>manage('remove');makeDefault.onclick=()=>manage('default');
 try{
  state=await api('/guest-details',{timeoutMs:5000});if(!form.isConnected)return null;
  render();remember.disabled=false;
  if(!hasDraft&&!touched){
   remember.checked=!!state.profileId;
   for(const [name,key]of [['customer','name'],['phone','phone']])if(!field(name).value&&!field(name).readOnly)field(name).value=state.customer?.[key]||'';
   const address=state.addresses.find(a=>a.id===state.defaultAddressId);
   if(address&&!field('addressLine1')?.value&&!field('addressLine2')?.value){field('savedAddressId').value=address.id;applySavedAddress(form,address);labelAddress(address);}
  }
 }catch{status.textContent='Saved details unavailable. Enter your details.';}
 sync();
 return {sync,afterRestore(draft){
  if(!draft||remember.disabled)return;
  const saved=name=>draft.find(input=>input.name===name)?.value||'';
  if(saved('savedProfileId')&&saved('savedProfileId')!==state.profileId){
   for(const name of ['customer','phone'])if(!field(name).readOnly)field(name).value='';
   clearAddress();remember.checked=false;field('savedProfileId').value=state.profileId||'';onForget();
   status.textContent='Saved details unavailable. Enter them again.';
  }else if(saved('savedAddressId')&&!state.addresses.some(address=>address.id===saved('savedAddressId'))){
   clearAddress();onForget();status.textContent='Address removed. Choose another.';
  }
  sync();
 }};
}
