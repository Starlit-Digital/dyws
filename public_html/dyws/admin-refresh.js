/** Refresh only clean, idle forms. Drafts and credentials stay in this page's memory. */
const groups=new WeakMap();
const values=forms=>JSON.stringify(forms.map(form=>[...form.elements].filter(e=>!['button','submit','reset'].includes(e.type)).map(e=>[e.name,e.value,e.checked,e.selectedIndex])));
export function createGuardedRefresh({read,apply,forms=[],blocked=()=>false,version=()=>0,initial,onError=()=>{},document:doc=globalThis.document}){
 let baseline=values(forms),signature=initial===undefined?undefined:JSON.stringify(initial),epoch=0,pending=false,alive=true;
 const reset=data=>{baseline=values(forms);if(data!==undefined)signature=JSON.stringify(data);epoch++;pending=false;};
 return {reset,get pending(){return pending;},async refresh(){
  const start=epoch,actionVersion=version(),before=values(forms);
  try{const data=await read();if(!alive)return;
   const next=JSON.stringify(data);if(next===signature){pending=false;return;}
   const focused=forms.some(form=>form.contains(doc?.activeElement)&&doc.activeElement?.matches?.('input,select,textarea,[contenteditable]'));
   if(blocked()||focused||before!==baseline||values(forms)!==before||epoch!==start||version()!==actionVersion){pending=true;return;}
   apply(data);reset(data);
  }catch(error){if(alive)onError(error);}
 },destroy(){alive=false;}};
}
export function adminRefreshGroup(root){
 if(groups.has(root))return groups.get(root);
 const tasks=new Set();let busy=0,epoch=0,running=false,again=false,alive=true;
 const group={
  actionStart(){busy++;epoch++;},actionEnd(){busy--;epoch++;},
  register(options){const task=createGuardedRefresh({...options,document:root.ownerDocument||root,version:()=>epoch,blocked:()=>busy>0||options.blocked?.()});tasks.add(task);return task;},
  async refresh(){if(!alive)return;if(running){again=true;return;}if(busy)return;running=true;
   try{await Promise.all([...tasks].map(task=>task.refresh()));if(!alive)return;
    let notice=root.querySelector('[data-dyws-update-notice]');const pending=[...tasks].some(task=>task.pending);
    if(pending&&!notice){notice=(root.ownerDocument||root).createElement('p');notice.dataset.dywsUpdateNotice='true';notice.className='dyws-update-notice';notice.setAttribute('role','status');root.querySelector('main')?.prepend(notice);}
    if(notice){notice.hidden=!pending;notice.textContent=pending?'Saved data has changed. Your open edits are kept. Save or reload that form when ready.':'';}
   }finally{running=false;if(again){again=false;queueMicrotask(()=>group.refresh());}}
  },destroy(){alive=false;for(const task of tasks)task.destroy();tasks.clear();groups.delete(root);}
 };groups.set(root,group);return group;
}
export function mountAdminRefresh({root,api,token,onRefresh=()=>{},onUnauthorized=()=>{}}){
 const group=adminRefreshGroup(root),doc=root.ownerDocument||root,win=doc.defaultView||globalThis.window;
 const refresh=()=>{if(!doc.hidden){void group.refresh();void Promise.resolve().then(onRefresh).catch(()=>{});}};
 const stop=api.watch?.({scope:'operator',token,interval:15000},event=>{if(event.type==='auth-error'&&[401,403].includes(event.status))onUnauthorized();else refresh();});
 const timer=api.watch?null:setInterval(refresh,15000);
 doc.addEventListener('visibilitychange',refresh);win.addEventListener('focus',refresh);win.addEventListener('online',refresh);
 return {refresh,destroy(){stop?.();clearInterval(timer);doc.removeEventListener('visibilitychange',refresh);win.removeEventListener('focus',refresh);win.removeEventListener('online',refresh);group.destroy();}};
}
