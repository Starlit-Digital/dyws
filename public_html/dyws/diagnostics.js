/** Opt in, tab-local measurements. Never records payloads, headers, tokens or URL queries. */
export function safeTimingPath(value,base='https://example.invalid/') {
 try{return new URL(value,base).pathname.replace(/\/[A-Z]{2,7}-[A-F0-9]{12}(?=\/|$)/g,'/:order');}catch{return '(invalid path)';}
}
const enabled=typeof document!=='undefined'&&(document.body?.classList.contains('dyws-admin')||document.querySelector?.('meta[name="dyws-page-data"]'))&&new URL(location.href).searchParams.get('diagnostics')==='1';
const entries=[],ready=new Set();let panel;
const round=n=>Math.round(n*10)/10;
export async function traceLoad(name,task){
 if(!enabled)return task();
 const start=performance.now();let ok=false;
 try{const result=await task();ok=true;return result;}finally{entries.push({name,start:round(start),duration:round(performance.now()-start),ok});if(entries.length>200)entries.shift();render();}
}
export function markReady(name='Page ready'){
 if(typeof document!=='undefined'&&name==='Page ready'){document.querySelector('[data-dyws-skeleton]')?.remove();document.querySelector('[data-dyws-initial-preview]')?.remove();}
 if(!enabled||ready.has(name))return;ready.add(name);entries.push({name,start:0,duration:round(performance.now()),ok:true});render();
}
function snapshot(){
 const n=performance.getEntriesByType('navigation')[0];
 const resources=performance.getEntriesByType('resource').filter(r=>new URL(r.name).origin===location.origin).map(r=>({path:safeTimingPath(r.name,location.href),kind:r.initiatorType,start:round(r.startTime),duration:round(r.duration),ttfb:round(r.responseStart-r.requestStart),bytes:r.transferSize,cached:r.transferSize===0,server:r.serverTiming?.map(t=>({name:t.name,duration:round(t.duration)}))||[]}));
 return {page:location.pathname,navigation:n?{ttfb:round(n.responseStart-n.requestStart),domReady:round(n.domContentLoadedEventEnd),load:round(n.loadEventEnd),server:n.serverTiming?.map(t=>({name:t.name,duration:round(t.duration)}))||[]}:null,phases:[...entries],resources};
}
function render(){
 if(!panel)return;const data=snapshot(),page=data.phases.find(p=>p.name==='Page ready');
 panel.querySelector('summary').textContent='Load diagnostics'+(page?' · ready '+(page.duration/1000).toFixed(2)+' s':' · measuring');
 panel.querySelector('[data-load-report]').textContent=JSON.stringify(data,null,2);
 const slow=data.phases.filter(p=>p.name!=='Page ready').sort((a,b)=>b.duration-a.duration).slice(0,12);
 panel.querySelector('[data-load-summary]').textContent='First response: '+(data.navigation?.ttfb??0)+' ms. '+data.resources.length+' requests.\n'+slow.map(p=>p.name+': '+p.duration+' ms'+(p.ok?'':' (failed)')).join('\n');
}
if(enabled){
 panel=document.createElement('details');panel.className='dyws-load-diagnostics';panel.innerHTML='<summary>Load diagnostics · measuring</summary><p>Local measurements only. Refresh captures the latest timings.</p><pre data-load-summary></pre><button type="button" data-load-refresh>Refresh timings</button> <button type="button" data-load-download>Download JSON</button><details><summary>All timings</summary><pre data-load-report></pre></details>';
 document.body.append(panel);panel.querySelector('[data-load-refresh]').onclick=render;
 panel.querySelector('[data-load-download]').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(snapshot(),null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='dyws-load-diagnostics.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 window.addEventListener('load',()=>setTimeout(render,0));render();
}
