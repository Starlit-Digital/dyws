import {createAddressSearch} from './search.js';
const cssURL=new URL('./lookup.css?v=1',import.meta.url).href;
function element(doc,tag,text,className){const node=doc.createElement(tag);if(text)node.textContent=text;if(className)node.className=className;return node;}
function setValue(input,value){if(!input||value===undefined||value===null)return;input.value=String(value).slice(0,input.maxLength>0?input.maxLength:500);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}
function widget({doc,api,config,onSelect}){
 const box=element(doc,'section',null,'dyws-address-lookup');box.setAttribute('aria-label','Address lookup');
 const label=element(doc,'label','Find an address'),input=element(doc,'input');input.type='search';input.maxLength=240;input.autocomplete='off';input.placeholder=config.demo?'Try the example address':'Street address and city';label.append(input);
 const button=element(doc,'button','Search');button.type='button';
 const status=element(doc,'p',null,'dyws-lookup-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const results=element(doc,'ul',null,'dyws-lookup-results');
 const note=element(doc,'p',config.demo?'Demo uses a fixed example address.':'Searches Alberta addresses. You can also enter your address below.','dyws-lookup-note');
 const attribution=element(doc,'a','© OpenStreetMap contributors');attribution.href='https://www.openstreetmap.org/copyright';attribution.target='_blank';attribution.rel='noopener noreferrer';
 const civicSource=element(doc,'p','Adapted from Statistics Canada, National Address Register, June 2026. This does not constitute an endorsement by Statistics Canada of this product.','dyws-lookup-note');
 box.append(label,button,status,results,note,attribution);if(!config.demo)box.append(civicSource);
 const search=createAddressSearch({api,onStatus:text=>{if(box.isConnected)status.textContent=text;},onResults:rows=>{
  results.replaceChildren();for(const row of rows){const li=element(doc,'li'),pick=element(doc,'button',row.label);pick.type='button';pick.addEventListener('click',()=>{search.clear();onSelect(row);status.textContent='Address filled. Check the details before continuing.';});li.append(pick);results.append(li);}
 }});
 input.addEventListener('input',event=>{event.stopPropagation();if(config.automatic)search.queue(input.value);else search.clear();});
 input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();event.stopPropagation();void search.search(input.value);}if(event.key==='Escape'){event.stopPropagation();search.clear();}});
 button.addEventListener('click',()=>{void search.search(input.value);});
 return {box,input,clear:()=>search.clear(),destroy:()=>search.destroy()};
}
export function register(plugin){
 const doc=plugin.document,cleanups=new Set();
 plugin.onDestroy(()=>{for(const cleanup of cleanups)cleanup();cleanups.clear();});
 let configPromise;
 const config=()=>configPromise??=plugin.api('/plugins/nominatim/config',{timeoutMs:5000}).catch(()=>({enabled:false}));
 plugin.addAction('checkout:fields',async({root,form})=>{
  const settings=await config();if(!settings.enabled||!form.isConnected)return;
  if(!root||root.querySelector('.dyws-address-lookup'))return;
  const address=form.querySelector('.dyws-delivery-address');if(address)address.before(root);
  const fieldset=element(doc,'div'),grid=element(doc,'div',null,'dyws-checkout-grid');fieldset.dataset.dywsDelivery='';fieldset.append(grid);root.append(fieldset);
  const link=element(doc,'link');link.rel='stylesheet';link.href=cssURL;fieldset.append(link);
  for(const [name,title,auto,max]of [['addressCity','City','address-level2',80],['addressRegion','Province','address-level1',60],['addressCountry','Country','country-name',60]]){
   if(form.elements.namedItem(name))continue;
   const label=element(doc,'label',title),input=element(doc,'input');input.name=name;input.autocomplete=auto;input.maxLength=max;label.dataset.dywsDelivery='';label.dataset.dywsOrderField=({addressCity:'city',addressRegion:'region',addressCountry:'country'})[name];label.append(input);grid.append(label);
  }
  if(settings.demo)for(const [name,value]of Object.entries({addressCity:'Edmonton',addressRegion:'AB',addressCountry:'Canada'})){const input=form.elements.namedItem(name);input.value=value;input.readOnly=true;}
  const view=widget({doc,api:plugin.api,config:settings,onSelect:row=>{
   for(const [key,name]of Object.entries({line1:'addressLine1',city:'addressCity',region:'addressRegion',postalCode:'addressPostal',country:'addressCountry'}))setValue(form.elements.namedItem(name),row[key]);
   form.elements.namedItem('addressLine1')?.focus();
  }});fieldset.prepend(view.box);if(address)view.box.after(address);
  const observer=new MutationObserver(()=>{
   if(!form.isConnected){cleanup();return;}
   const cell=form.querySelector('.dyws-order-cell[data-field="street"]');
   if(cell&&!cell.contains(view.box)){view.box.dataset.dywsDelivery='';view.box.hidden=form.elements.fulfillment.value!=='delivery';cell.prepend(view.box);}
  });observer.observe(form.parentNode,{childList:true});observer.observe(form,{childList:true});
  const stop=()=>view.clear();form.addEventListener('submit',stop);const fulfillment=()=>{if(form.elements.fulfillment.value!=='delivery')stop();};form.addEventListener('change',fulfillment);const dialog=form.closest('dialog');dialog?.addEventListener('close',stop);
  const cleanup=()=>{view.destroy();observer.disconnect();form.removeEventListener('submit',stop);form.removeEventListener('change',fulfillment);dialog?.removeEventListener('close',stop);cleanups.delete(cleanup);};cleanups.add(cleanup);
 });
 plugin.addAction('admin:settings',async({root,api})=>{
  const settings=await config();
  const business=root.querySelector('#business-settings');
  if(settings.enabled&&business&&!business.dataset.dywsAddressLookup){
   business.dataset.dywsAddressLookup='';const mounted=new WeakSet(),views=new Set();
   const mount=()=>{for(const view of views)if(!view.box.isConnected){view.destroy();views.delete(view);}for(const target of business.querySelectorAll('[name="pickupAddress"],[data-location-field="address"]')){
    if(mounted.has(target))continue;mounted.add(target);
    const details=element(doc,'details',null,'dyws-location-lookup'),summary=element(doc,'summary','Find address');details.append(summary);
    const view=widget({doc,api,config:settings,onSelect:row=>{setValue(target,[row.line1,row.city,row.region,row.postalCode,row.country].filter(Boolean).join(', '));details.open=false;target.focus();}});
    view.input.value=target.value;details.append(view.box);target.closest('label').after(details);views.add(view);
   }};
   mount();const observer=new MutationObserver(mount);observer.observe(business,{childList:true,subtree:true});
   cleanups.add(()=>{observer.disconnect();views.forEach(view=>view.destroy());delete business.dataset.dywsAddressLookup;});
  }
  const container=root.querySelector('[data-dyws-plugin-settings]');if(!container||container.querySelector('#plugin-nominatim'))return;
  const panel=element(doc,'section');panel.id='plugin-nominatim';panel.append(element(doc,'h2','Nominatim Address Lookup'));
  const form=element(doc,'form'),label=element(doc,'label','Enable address suggestions '),enabled=element(doc,'input');enabled.type='checkbox';label.append(enabled);
  const note=element(doc,'p'),save=element(doc,'button','Save address lookup'),status=element(doc,'p');save.type='submit';status.setAttribute('role','status');form.append(label,note,save,status);panel.append(form);container.append(panel);
  let state;
  try{state=await api('/manager/plugins/nominatim/settings',{token:sessionStorage.getItem('dyws-manager'),timeoutMs:5000});}
  catch{note.textContent='Address lookup settings are unavailable.';save.disabled=true;return;}
  enabled.checked=state.enabled;enabled.disabled=state.demo||!state.configured;save.disabled=state.demo||!state.configured;
  note.textContent=state.demo?'The public demo uses a fixed example address.':state.configured?'Connected to our Alberta address service. Customers can always enter an address manually.':'The installation owner needs to connect this plugin to a private Nominatim service.';
  form.addEventListener('submit',async event=>{event.preventDefault();save.disabled=true;try{state=await api('/manager/plugins/nominatim/settings',{method:'POST',token:sessionStorage.getItem('dyws-manager'),body:{enabled:enabled.checked,revision:state.revision},timeoutMs:10000});configPromise=null;status.textContent='Address lookup settings saved.';}catch(error){status.textContent=error.message||'Could not save address lookup settings.';}finally{save.disabled=false;}});
 });
}
