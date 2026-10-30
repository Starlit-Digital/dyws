import {traceLoad} from './diagnostics.js';
/** Loads only installed, active plugins advertised by the same origin API. */
export async function createPluginHost({api,baseURL=new URL('../plugins/',import.meta.url),loadModule=url=>import(url),document:doc=globalThis.document}={}) {
 const actions=new Map(),filters=new Map(),validators=new Map(),providers=new Map(),errors=[],styles=[],cleanup=[];let validationUnavailable=false;
 const root=new URL(baseURL);let manifest;
 try{manifest=await api('/plugins');}catch{manifest={plugins:[]};errors.push('Plugins could not be loaded.');}
 const pending=[];
 for(const plugin of Array.isArray(manifest?.plugins)?manifest.plugins:[]){
  if(!plugin||plugin.apiVersion!==1||!/^[a-z][a-z0-9-]{0,59}$/.test(plugin.id)||!plugin.browserModule)continue;
  if(!/^[a-zA-Z0-9_-]+\.js$/.test(plugin.browserModule)||(plugin.stylesheet&&!/^[a-zA-Z0-9_-]+\.css$/.test(plugin.stylesheet)))continue;
  const url=new URL(plugin.id+'/'+plugin.browserModule,root);url.searchParams.set('v',plugin.version);
  if(url.origin!==root.origin||!url.pathname.startsWith(root.pathname))continue;
  pending.push({plugin,loaded:traceLoad('Plugin import '+plugin.id,()=>loadModule(url.href)).then(module=>({module}),error=>({error}))});
 }
 for(const {plugin,loaded}of pending){
  const localActions=[],localFilters=[],localValidators=[],localProviders=[],localCleanup=[];let style,committed=false;
  const add=(collection,staged,name,fn,priority=10)=>{
   if(typeof name!=='string'||typeof fn!=='function'||!Number.isFinite(priority))throw new TypeError('Invalid plugin hook.');
   if(committed){if(!collection.has(name))collection.set(name,[]);collection.get(name).push({fn,priority});}else staged.push([name,fn,priority]);
  };
  const removeOwn=(collection,staged,name,fn)=>{for(let i=staged.length-1;i>=0;i--)if(staged[i][0]===name&&staged[i][1]===fn)staged.splice(i,1);collection.set(name,(collection.get(name)||[]).filter(entry=>entry.fn!==fn));};
  try{
   const result=await loaded;if(result.error)throw result.error;const module=result.module;if(typeof module.register!=='function')throw new Error('Missing plugin registration.');
   await traceLoad('Plugin register '+plugin.id,()=>module.register({api,document:doc,addAction:(...args)=>add(actions,localActions,...args),addFilter:(...args)=>add(filters,localFilters,...args),addValidator:(...args)=>add(validators,localValidators,...args),removeAction:(...args)=>removeOwn(actions,localActions,...args),removeFilter:(...args)=>removeOwn(filters,localFilters,...args),removeValidator:(...args)=>removeOwn(validators,localValidators,...args),onDestroy:fn=>(committed?cleanup:localCleanup).push(fn),provide:(name,fn)=>{if(committed){if(!providers.has(name))providers.set(name,fn);}else localProviders.push([name,fn]);}}));
   if(plugin.stylesheet&&doc&&!doc.querySelector?.('[data-dyws-plugin-style="'+plugin.id+'"]')){style=doc.createElement('link');style.rel='stylesheet';const css=new URL(plugin.id+'/'+plugin.stylesheet,root);css.searchParams.set('v',plugin.version);style.href=css.href;doc.head.append(style);styles.push(style);}
   for(const [name,fn,priority]of localActions){if(!actions.has(name))actions.set(name,[]);actions.get(name).push({fn,priority});}
   for(const [name,fn,priority]of localFilters){if(!filters.has(name))filters.set(name,[]);filters.get(name).push({fn,priority});}
   for(const [name,fn,priority]of localValidators){if(!validators.has(name))validators.set(name,[]);validators.get(name).push({fn,priority});}
   cleanup.push(...localCleanup);
   for(const [name,fn]of localProviders)if(!providers.has(name))providers.set(name,fn);committed=true;
  }catch{style?.remove();for(const fn of localCleanup)try{fn();}catch{}if(plugin.capabilities?.includes('validation'))validationUnavailable=true;errors.push(plugin.id+' could not load.');}
 }
 const recordError=message=>{if(!errors.includes(message))errors.push(message);};
 const runAction=async(name,...args)=>{for(const {fn}of [...(actions.get(name)||[])].sort((a,b)=>a.priority-b.priority))try{await traceLoad('Hook '+name,()=>fn(...args));}catch{recordError('A plugin could not finish '+name+'.');}};
 const applyFilters=async(name,value,...args)=>{for(const {fn}of [...(filters.get(name)||[])].sort((a,b)=>a.priority-b.priority))try{value=await fn(value,...args);}catch{recordError('A plugin filter failed.');}return value;};
 const validate=async(name,...args)=>{
  if(validationUnavailable)throw new Error('A required checkout plugin could not load. Reload before trying again.');
  for(const {fn}of [...(validators.get(name)||[])].sort((a,b)=>a.priority-b.priority))if(await fn(...args)===false)throw new Error('Please check the additional checkout fields.');
 };
 const remove=(collection,name,fn)=>collection.set(name,(collection.get(name)||[]).filter(entry=>entry.fn!==fn));
 function createLocationRenderer(options={}){
  const provider=providers.get('location.renderer');if(provider)try{return provider({api,...options});}catch{errors.push('The map plugin is unavailable.');}
  const node=doc.createElement('p');node.className='dyws-note';node.textContent='Live map unavailable.';
  const render=(position,role,{onEstimate}={})=>{node.hidden=!position;onEstimate?.(null);return node;};render.clear=()=>{node.hidden=true;};render.destroy=render.clear;return render;
 }
 function renderPayment(options){
  const provider=providers.get('payment.renderer.'+options.order.paymentProvider);
  if(provider)try{return provider({api,document:doc,...options});}catch{errors.push('Payment controls could not load.');}
  const note=doc.createElement('p');note.className='dyws-note';note.textContent=options.order.checkoutStatus==='pending'?'Payment confirmation is pending. Please do not place a duplicate order.':'Online payment is unavailable. Contact the business for help with this order.';options.container.append(note);
 }
 async function renderReports(options){
  const provider=providers.get('reports.renderer');if(!provider)return false;
  try{if(await provider({...options,applyFilters,runAction})===true)return true;}catch{recordError('The report plugin could not render.');}
  await runAction('admin:tables',{root:options.root,phase:'dispose'});options.root.replaceChildren();return false;
 }
 const orderLayout=stage=>{try{return providers.get('order.layout')?.(stage)||null;}catch{return null;}};
 const createPickupMap=(options={})=>{try{return providers.get('pickup.map')?.({api,document:doc,...options})||null;}catch{recordError('The pickup map could not load.');return null;}};
 const createPickup=options=>providers.get('checkout.pickup')?.(options)||null;
 return {createPickup,runAction,applyFilters,validate,orderLayout,createPickupMap,createLocationRenderer,renderPayment,renderReports,errors,removeAction:(name,fn)=>remove(actions,name,fn),removeFilter:(name,fn)=>remove(filters,name,fn),removeValidator:(name,fn)=>remove(validators,name,fn),destroy(){for(const fn of cleanup)try{fn();}catch{}styles.forEach(style=>style.remove());actions.clear();filters.clear();validators.clear();providers.clear();}};
}
