import {escapeHTML as esc} from './api.js';
import {decimalToMinor,createCatalogDraft} from './catalog-editor.js?v=39';

/** Business fields share the catalog revision so concurrent edits cannot overwrite items. */
export async function mountBusinessSettings({root,page}){
 const form=root.querySelector('#business-settings');if(!form)return;
 const fields=form.querySelector('fieldset'),message=root.querySelector('#business-message');
 let catalog,revision,dirty=false,refresh,latest;
 const locationRows=form.querySelector('#business-locations');
 const mark=()=>{dirty=true;message.textContent='Unsaved changes';};
 function addLocation(location){
  const row=document.createElement('div');row.className='dyws-business-location-row';row.dataset.locationId=location.id;
  row.innerHTML=`<label>Location name<input data-location-field="name" required maxlength="120" value="${esc(location.name)}"></label><label>Address<input data-location-field="address" required maxlength="240" value="${esc(location.address)}"></label><label>Phone, optional<input data-location-field="phone" type="tel" maxlength="30" pattern="[0-9+() .-]{7,30}" value="${esc(location.phone||'')}"></label><label class="dyws-checkbox"><input data-location-field="active" type="checkbox" ${location.active!==false?'checked':''}> Available</label><button type="button" class="dyws-secondary" aria-label="Remove ${esc(location.name||'location')}">Remove</button>`;
  row.querySelector('button').onclick=()=>{row.remove();mark();form.querySelector('#add-business-location').focus();};locationRows.append(row);return row;
 }
 form.querySelector('#add-business-location').onclick=()=>{const row=addLocation({id:'location_'+crypto.randomUUID().replaceAll('-',''),name:'',address:'',phone:'',active:true});mark();row.querySelector('input').focus();};
 function display(data){latest=data;
  catalog=createCatalogDraft(data.catalog);revision=data.revision;
  for(const key of ['businessName','platformName','pickupAddress','businessPhone','businessEmail','currency'])form.elements[key].value=catalog[key]??'';
  for(const key of ['taxBasisPoints','deliveryFee'])form.elements[key].value=(catalog[key]/100).toFixed(2);
  form.elements.itemOrderCap.value=catalog.itemOrderCap??10;
  locationRows.replaceChildren();for(const location of catalog.locations||[])addLocation(location);
  fields.disabled=false;dirty=false;refresh?.reset(data);
 }
 async function reload(){display(await page.request('/manager/catalog'));message.textContent='';}
 form.oninput=()=>{dirty=true;message.textContent='Unsaved changes';};
 form.onsubmit=event=>{event.preventDefault();page.action(event.submitter,async()=>{
  const updated=createCatalogDraft(catalog);
  for(const key of ['businessName','platformName','pickupAddress','businessPhone','businessEmail'])updated[key]=form.elements[key].value;
  for(const key of ['taxBasisPoints','deliveryFee'])updated[key]=decimalToMinor(form.elements[key].value);
  updated.itemOrderCap=Number(form.elements.itemOrderCap.value);
  updated.locations=[...locationRows.children].map(row=>({id:row.dataset.locationId,...Object.fromEntries([...row.querySelectorAll('[data-location-field]')].map(input=>[input.dataset.locationField,input.type==='checkbox'?input.checked:input.value.trim()]))}));
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
