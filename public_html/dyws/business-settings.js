import {decimalToMinor,createCatalogDraft} from './catalog-editor.js?v=35';

/** Business fields share the catalog revision so concurrent edits cannot overwrite items. */
export async function mountBusinessSettings({root,page}){
 const form=root.querySelector('#business-settings');if(!form)return;
 const fields=form.querySelector('fieldset'),message=root.querySelector('#business-message');
 let catalog,revision,dirty=false;
 function display(data){
  catalog=createCatalogDraft(data.catalog);revision=data.revision;
  for(const key of ['businessName','platformName','pickupAddress','currency'])form.elements[key].value=catalog[key]??'';
  for(const key of ['taxBasisPoints','deliveryFee'])form.elements[key].value=(catalog[key]/100).toFixed(2);
  fields.disabled=false;dirty=false;
 }
 async function reload(){display(await page.request('/manager/catalog'));message.textContent='';}
 form.oninput=()=>{dirty=true;message.textContent='Unsaved changes';};
 form.onsubmit=event=>{event.preventDefault();page.action(event.submitter,async()=>{
  const updated=createCatalogDraft(catalog);
  for(const key of ['businessName','platformName','pickupAddress'])updated[key]=form.elements[key].value;
  for(const key of ['taxBasisPoints','deliveryFee'])updated[key]=decimalToMinor(form.elements[key].value);
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
}
