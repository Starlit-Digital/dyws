import {traceLoad,safeTimingPath} from '../dyws/diagnostics.js';
// Website endpoint configuration and compatibility exports.
import {initializeAdminSession,redirectToAuth} from '../dyws/admin-session.js?v=37';
import {createRealtimeAPI} from '../dyws/realtime.js';
export {money,escapeHTML,statusText} from '../dyws/api.js';
export const endpoint=new URL('../api/',import.meta.url);
initializeAdminSession();
const bootstrap=JSON.parse(document.querySelector('meta[name="dyws-admin-data"]')?.content||'null');
const transport=createRealtimeAPI(endpoint,{config:bootstrap?.realtime});
const initial=new Map(Object.entries(bootstrap?.responses||{}));
const takeInitial=(route,options={})=>{if((options.method||'GET')!=='GET')return;const [path,query='']=route.split('?');if(!initial.has(path))return;
 if(path==='/manager/reports'){const params=new URLSearchParams(query),expected=bootstrap.reportQuery;if([...params.keys()].some(key=>!Object.hasOwn(expected,key))||Object.entries(expected).some(([key,value])=>(params.get(key)|| (key==='fulfillment'?'all':null))!==value))return;}
 const value=initial.get(path);initial.delete(path);return value;};
const expired=error=>{if(document.body.classList.contains('dyws-admin')&&error.status===401)redirectToAuth();};
export const api=Object.assign(async(...args)=>{try{const seeded=takeInitial(...args);return await traceLoad((seeded!==undefined?'Initial data ':'API ')+safeTimingPath(args[0]),()=>seeded!==undefined?seeded:transport(...args));}catch(error){expired(error);throw error;}},transport);
api.watch=(options,callback)=>{let first=!!bootstrap;return transport.watch(options,event=>{if(event.type==='auth-error')expired(event);if(first&&['sync','poll'].includes(event.type)){first=false;return;}first=false;return callback(event);});};
Object.defineProperty(api,'transport',{get:()=>transport.transport});
window.addEventListener('pageshow',event=>{if(event.persisted&&document.body.classList.contains('dyws-admin'))location.reload();});

const label=document.createElement('p');label.className='dyws-connection-status';label.setAttribute('role','status');
const admin=document.body.classList.contains('dyws-admin'),customer=document.body.dataset.trackingPage==='true';
if(admin){const footer=document.createElement('footer');footer.className='dyws-admin-footer';document.body.append(footer);footer.append(label);}
else (document.querySelector('footer')||document.querySelector('header'))?.append(label);
api.onConnection(mode=>{label.hidden=customer;label.textContent=admin?(mode==='connecting'?'Connecting…':'Live updates'):(mode==='websocket'?'Live connection · WebSocket':mode==='connecting'?'Connecting…':'Live updates · HTTPS polling');label.title=mode==='websocket'?'WebSocket connection':'HTTPS polling';});
window.addEventListener('pagehide',()=>{api.close();if(admin)document.body.hidden=true;});window.addEventListener('pageshow',()=>api.resume());
