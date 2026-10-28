import {mountHoursEditor} from './business-hours-editor.js';
import {escapeHTML as esc} from './api.js';
import {decimalToMinor,createCatalogDraft} from './catalog-editor.js?v=options-20261028';

/** Business fields share the catalog revision so concurrent edits cannot overwrite items. */
export async function mountBusinessSettings({root,page}){
 const form=root.querySelector('#business-settings');if(!form)return;
 const fields=form.querySelector('fieldset'),message=root.querySelector('#business-message');
 let catalog,revision,dirty=false,refresh,latest,readLocationHours,readOrderingHours,readCancellation;
 const locationEditors=new WeakMap();
 const locationRows=form.querySelector('#business-locations');
 const mark=()=>{dirty=true;message.textContent='Unsaved changes';};
 function cancellationEditor(root,policy){
  root.innerHTML='<label class="dyws-checkbox"><input type="checkbox" data-cancellation-enabled> Allow customer cancellation</label><label data-cancellation-window>Window (minutes)<input type="number" inputmode="numeric" data-cancellation-minutes min="1" max="1440" step="1" required></label><p class="dyws-note">Full refund, including tip. Provider processing fees may still apply to the business.</p>';
  const enabled=root.querySelector('[data-cancellation-enabled]'),minutes=root.querySelector('[data-cancellation-minutes]');
  enabled.checked=policy?.enabled===true;minutes.value=policy?.minutes??4;
  const sync=()=>{minutes.disabled=!enabled.checked;root.querySelector('[data-cancellation-window]').hidden=!enabled.checked;};enabled.onchange=sync;sync();
  return ()=>({enabled:enabled.checked,minutes:Number(minutes.value)});
 }
 function syncDefaultCancellation(){form.querySelector('#business-cancellation').hidden=locationRows.children.length>0;}
 function addLocation(location){
  const row=document.createElement('div');row.className='dyws-business-location-row';row.dataset.locationId=location.id;
  row.innerHTML=`<label>Location name<input data-location-field="name" required maxlength="120" value="${esc(location.name)}"></label><label>Address<input data-location-field="address" required maxlength="240" value="${esc(location.address)}"></label><label>Phone, optional<input data-location-field="phone" type="tel" maxlength="30" pattern="[0-9+() .-]{7,30}" value="${esc(location.phone||'')}"></label><label class="dyws-checkbox"><input data-location-field="active" type="checkbox" ${location.active!==false?'checked':''}> Available</label><button type="button" class="dyws-secondary" aria-label="Remove ${esc(location.name||'location')}">Remove</button>`;
  row.querySelector('button').onclick=()=>{row.remove();syncDefaultCancellation();mark();form.querySelector('#add-business-location').focus();};locationRows.append(row);
  const extras=document.createElement('div');extras.className='dyws-location-policy';extras.innerHTML='<div data-location-hours></div><div data-ordering-hours></div><details><summary>Delivery pricing</summary><label class="dyws-checkbox"><input type="checkbox" data-pricing-override> Set delivery pricing for this location</label><div class="dyws-field-grid" data-pricing-fields><label>Flat delivery fee<input type="number" data-flat-fee min="0" max="1000" step="0.01" required></label><label>Delivery percentage (%)<input type="number" data-fee-percent min="0" max="100" step="0.01" required></label></div><p class="dyws-note">The percentage applies to the item subtotal before tax. Set either amount to zero to use only the other. Both zero means free delivery.</p></details><section data-cancellation><h4>Customer cancellation</h4><div data-cancellation-editor></div></section>';row.append(extras);
  const readLocationHours=mountHoursEditor(extras.querySelector('[data-location-hours]'),{label:'Location hours',schedule:location.locationHours,inherit:true});
  const readOrderingHours=mountHoursEditor(extras.querySelector('[data-ordering-hours]'),{label:'Ordering hours',schedule:location.orderingHours,inherit:true});
  const override=extras.querySelector('[data-pricing-override]'),flat=extras.querySelector('[data-flat-fee]'),percent=extras.querySelector('[data-fee-percent]');
  override.checked=!!location.deliveryPricing;flat.value=((location.deliveryPricing?.flatFee??catalog?.deliveryFee??0)/100).toFixed(2);percent.value=((location.deliveryPricing?.basisPoints??catalog?.deliveryFeeBasisPoints??0)/100).toFixed(2);
  const sync=()=>{flat.disabled=percent.disabled=!override.checked;extras.querySelector('[data-pricing-fields]').hidden=!override.checked;};override.onchange=sync;sync();
  const readCancellation=cancellationEditor(extras.querySelector('[data-cancellation-editor]'),location.customerCancellation);syncDefaultCancellation();
  locationEditors.set(row,()=>({customerCancellation:readCancellation(),locationHours:readLocationHours(),orderingHours:readOrderingHours(),deliveryPricing:override.checked?{flatFee:decimalToMinor(flat.value),basisPoints:decimalToMinor(percent.value)}:null}));return row;
 }
 form.querySelector('#add-business-location').onclick=()=>{const row=addLocation({id:'location_'+crypto.randomUUID().replaceAll('-',''),name:'',address:'',phone:'',active:true});mark();row.querySelector('input').focus();};
 function display(data){latest=data;
  catalog=createCatalogDraft(data.catalog);revision=data.revision;
  for(const key of ['businessName','platformName','pickupAddress','businessPhone','businessEmail','currency'])form.elements[key].value=catalog[key]??'';
  for(const key of ['taxBasisPoints','deliveryFee','deliveryFeeBasisPoints'])form.elements[key].value=((catalog[key]??0)/100).toFixed(2);
  form.elements.itemOrderCap.value=catalog.itemOrderCap??10;form.elements.allowPayAtDoor.checked=catalog.allowPayAtDoor===true;form.elements.allowPayAtPickup.checked=catalog.allowPayAtPickup===true;
  readLocationHours=mountHoursEditor(form.querySelector('#business-location-hours'),{label:'Location hours',schedule:catalog.locationHours});
  readOrderingHours=mountHoursEditor(form.querySelector('#business-ordering-hours'),{label:'Ordering hours',schedule:catalog.orderingHours});
  readCancellation=cancellationEditor(form.querySelector('#business-cancellation-editor'),catalog.customerCancellation);
  locationRows.replaceChildren();for(const location of catalog.locations||[])addLocation(location);syncDefaultCancellation();
  fields.disabled=false;dirty=false;refresh?.reset(data);
 }
 async function reload(){display(await page.request('/manager/catalog'));message.textContent='';}
 form.addEventListener('invalid',event=>{const detail=event.target.closest('details');if(detail)detail.open=true;},true);
 form.oninput=()=>{dirty=true;message.textContent='Unsaved changes';};
 form.onsubmit=event=>{event.preventDefault();page.action(event.submitter,async()=>{
  const updated=createCatalogDraft(catalog);
  for(const key of ['businessName','platformName','pickupAddress','businessPhone','businessEmail'])updated[key]=form.elements[key].value;
  for(const key of ['taxBasisPoints','deliveryFee','deliveryFeeBasisPoints'])updated[key]=decimalToMinor(form.elements[key].value);
  updated.allowPayAtDoor=form.elements.allowPayAtDoor.checked;updated.allowPayAtPickup=form.elements.allowPayAtPickup.checked;updated.customerCancellation=readCancellation();updated.itemOrderCap=Number(form.elements.itemOrderCap.value);updated.locationHours=readLocationHours();updated.orderingHours=readOrderingHours();
  updated.locations=[...locationRows.children].map(row=>({id:row.dataset.locationId,...locationEditors.get(row)(),...Object.fromEntries([...row.querySelectorAll('[data-location-field]')].map(input=>[input.dataset.locationField,input.type==='checkbox'?input.checked:input.value.trim()]))}));
  fields.disabled=true;
  try{display(await page.request('/manager/catalog',{method:'POST',body:{catalog:updated,revision}}));message.textContent='Saved.';}
  finally{fields.disabled=false;}
 });};
 root.querySelector('#reload-business').onclick=event=>{
  if(dirty&&!confirm('Discard your unsaved business details?'))return;
  page.action(event.currentTarget,reload);
 };
 window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
 await reload();
 refresh=page.autoRefresh({read:()=>page.request('/manager/catalog'),apply:display,forms:[form],initial:latest,blocked:()=>dirty});
}
