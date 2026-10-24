/** Locked installation presentation. The PHP policy independently enforces every restriction. */
export function register(plugin){
 const doc=plugin.document;
 const banner=doc.createElement('p');banner.className='dyws-note';banner.dataset.dywsDemo='';
 banner.textContent='Admin: admin / admin. Driver: driver / driver. Settings are locked.';
 (doc.querySelector('main')||doc.body).prepend(banner);
 const locked=['catalog','drivers','password','settings','plugins'].includes(doc.body.dataset.adminPage);
 const lock=()=>{if(!locked)return;for(const el of doc.querySelectorAll('main input,main select,main textarea,main button')){
  if(/reload|refresh|cancel/.test(el.id)||el.hasAttribute('data-dyws-reload-plugins')||el.closest('#category-list'))continue;
  if(!el.disabled)el.disabled=true;
  el.title='Locked by the installation owner';
 }};
 lock();const observer=new MutationObserver(lock);if(locked)observer.observe(doc.querySelector('main'),{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});
 plugin.onDestroy(()=>{observer.disconnect();banner.remove();});
 plugin.addAction('checkout:fields',({form})=>{
  const fields={customer:'Jordan Taylor',phone:'7805550142',addressLine1:'123 Example Avenue NW',addressLine2:'',addressCity:'Edmonton',addressRegion:'AB',addressPostal:'T5A 1A1',addressCountry:'Canada',notes:''};
  for(const [name,value]of Object.entries(fields)){const input=form.elements.namedItem(name);if(input){input.value=value;input.readOnly=true;input.autocomplete='off';}}
 });
 plugin.provide('location.renderer',()=>{
  const figure=doc.createElement('figure'),img=doc.createElement('img'),caption=doc.createElement('figcaption');
  img.src=new URL('../../images/manning-area-map.png',import.meta.url).href;img.alt='Manning Town Centre reference map for simulated deliveries';img.style.width='100%';img.loading='lazy';
  caption.textContent='Simulated location at Manning Town Centre. No device GPS or live route requests.';figure.append(img,caption);
  const render=(point,role,{onEstimate}={})=>{figure.hidden=!point;onEstimate?.(null);return figure;};
  render.clear=()=>{figure.hidden=true;};render.destroy=()=>figure.remove();return render;
 });
}
