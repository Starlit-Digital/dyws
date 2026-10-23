/** Loads only installed, active plugins advertised by the same origin API. */
export async function createPluginHost({api,baseURL=new URL('../plugins/',import.meta.url),loadModule=url=>import(url),document:doc=globalThis.document}={}) {
 const actions=new Map(),filters=new Map(),providers=new Map(),errors=[],styles=[];
 const root=new URL(baseURL);let manifest;
 try{manifest=await api('/plugins');}catch{manifest={plugins:[]};errors.push('Plugins could not be loaded.');}
 for(const plugin of Array.isArray(manifest?.plugins)?manifest.plugins:[]){
  if(!plugin||plugin.apiVersion!==1||!/^[a-z][a-z0-9-]{0,59}$/.test(plugin.id)||!plugin.browserModule)continue;
  if(!/^[a-zA-Z0-9_-]+\.js$/.test(plugin.browserModule)||(plugin.stylesheet&&!/^[a-zA-Z0-9_-]+\.css$/.test(plugin.stylesheet)))continue;
  const url=new URL(plugin.id+'/'+plugin.browserModule,root);url.searchParams.set('v',plugin.version);
  if(url.origin!==root.origin||!url.pathname.startsWith(root.pathname))continue;
  const localActions=[],localFilters=[],localProviders=[];let style;
  try{
   const module=await loadModule(url.href);if(typeof module.register!=='function')throw new Error('Missing plugin registration.');
   await module.register({api,document:doc,addAction:(name,fn,priority=10)=>localActions.push([name,fn,priority]),addFilter:(name,fn,priority=10)=>localFilters.push([name,fn,priority]),provide:(name,fn)=>localProviders.push([name,fn])});
   if(plugin.stylesheet&&doc){style=doc.createElement('link');style.rel='stylesheet';const css=new URL(plugin.id+'/'+plugin.stylesheet,root);css.searchParams.set('v',plugin.version);style.href=css.href;doc.head.append(style);styles.push(style);}
   for(const [name,fn,priority]of localActions){if(!actions.has(name))actions.set(name,[]);actions.get(name).push({fn,priority});}
   for(const [name,fn,priority]of localFilters){if(!filters.has(name))filters.set(name,[]);filters.get(name).push({fn,priority});}
   for(const [name,fn]of localProviders)if(!providers.has(name))providers.set(name,fn);
  }catch{style?.remove();errors.push(plugin.id+' could not load.');}
 }
 const runAction=async(name,...args)=>{for(const {fn}of (actions.get(name)||[]).sort((a,b)=>a.priority-b.priority))try{await fn(...args);}catch{errors.push('A plugin could not finish '+name+'.');}};
 const applyFilters=async(name,value,...args)=>{for(const {fn}of (filters.get(name)||[]).sort((a,b)=>a.priority-b.priority))try{value=await fn(value,...args);}catch{errors.push('A plugin filter failed.');}return value;};
 function createLocationRenderer(options={}){
  const provider=providers.get('location.renderer');if(provider)try{return provider({api,...options});}catch{errors.push('The map plugin is unavailable.');}
  const node=doc.createElement('p');node.className='dyws-note';node.textContent='Live map unavailable.';
  const render=(position,role,{onEstimate}={})=>{node.hidden=!position;onEstimate?.(null);return node;};render.clear=()=>{node.hidden=true;};render.destroy=render.clear;return render;
 }
 return {runAction,applyFilters,createLocationRenderer,errors,destroy(){styles.forEach(style=>style.remove());}};
}
