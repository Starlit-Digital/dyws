/** Locked installation presentation. The PHP policy independently enforces every restriction. */
import {createDemoAccess} from './demo-login.js?v=2';
export function register(plugin){
 const doc=plugin.document,access=createDemoAccess({document:doc});
 const callout=position=>{
  const box=doc.createElement('section');box.className='dyws-demo-callout';box.dataset.dywsDemo=position;box.setAttribute('aria-labelledby','dyws-demo-title-'+position);
  const title=doc.createElement('h2');title.id='dyws-demo-title-'+position;title.textContent='This is a public demo';
  const intro=doc.createElement('p');intro.textContent='Try an order, explore the dashboard and take a delivery for a spin. Everything here is fictional. No real payments or deliveries.';
  const accounts=doc.createElement('div');accounts.className='dyws-demo-accounts';
  for(const [role,user]of [['Admin','admin'],['Driver','driver']]){
   const card=doc.createElement('div'),heading=doc.createElement('h3'),credentials=doc.createElement('p');
   heading.textContent=role+' demo';
   for(const [label,value]of [['Username',user],['Password',user]]){const row=doc.createElement('span'),code=doc.createElement('code');row.append(label+' ');code.textContent=value;row.append(code);credentials.append(row);}
   card.append(heading,credentials,access.link(user,'Open '+role+' demo'));accounts.append(card);
  }
  const note=doc.createElement('p');note.className='dyws-demo-note';note.textContent='These sign ins are public. Everyone shares this demo. Settings are locked, device GPS is off, and orders expire after 24 hours. Checkout uses fictional contact details.';
  box.append(title,intro,accounts,note);return box;
 };
 // Credential callouts belong to the storefront, not tracking or operator workflows.
 const banners=[];
 if(doc.querySelector('dyws-ordering')){
  const banner=callout('top'),footer=callout('bottom');banners.push(banner,footer);
  (doc.querySelector('main')||doc.body).prepend(banner);
  (doc.querySelector('footer')||doc.querySelector('main')||doc.body).append(footer);
  void access.enterFromURL();
 }
 // Keep role switching beside the order controls, without credential boxes.
 plugin.addAction('admin:order',({root})=>{root.append(access.link('driver','Open Driver demo'));});
 const driverActions=doc.querySelector('#driver-board:not([hidden]) > .dyws-actions');
 if(driverActions){const adminLink=access.link('admin','Admin orders');driverActions.append(adminLink);plugin.onDestroy(()=>adminLink.remove());}
 const locked=['catalog','drivers','password','settings','plugins'].includes(doc.body.dataset.adminPage);
 const lock=()=>{if(!locked)return;for(const el of doc.querySelectorAll('main input,main select,main textarea,main button')){
  if(/reload|refresh|cancel/.test(el.id)||el.hasAttribute('data-dyws-reload-plugins')||el.closest('#category-list'))continue;
  if(!el.disabled)el.disabled=true;
  el.title='Locked by the installation owner';
 }};
 lock();const observer=new MutationObserver(lock);if(locked)observer.observe(doc.querySelector('main'),{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});
 plugin.onDestroy(()=>{observer.disconnect();banners.forEach(banner=>banner.remove());});
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
