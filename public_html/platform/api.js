// Website endpoint configuration and compatibility exports.
import {initializeAdminSession,redirectToAuth} from '../dyws/admin-session.js?v=36';
import {createRealtimeAPI} from '../dyws/realtime.js';
export {money,escapeHTML,statusText} from '../dyws/api.js';
export const endpoint=new URL('../api/',import.meta.url);
initializeAdminSession();
const transport=createRealtimeAPI(endpoint);
const expired=error=>{if(document.body.classList.contains('dyws-admin')&&error.status===401)redirectToAuth();};
export const api=Object.assign(async(...args)=>{try{return await transport(...args);}catch(error){expired(error);throw error;}},transport);
api.watch=(options,callback)=>transport.watch(options,event=>{if(event.type==='auth-error')expired(event);return callback(event);});
Object.defineProperty(api,'transport',{get:()=>transport.transport});
window.addEventListener('pageshow',event=>{if(event.persisted&&document.body.classList.contains('dyws-admin'))location.reload();});

const label=document.createElement('p');label.className='dyws-connection-status';label.setAttribute('role','status');
const admin=document.body.classList.contains('dyws-admin'),customer=document.body.dataset.trackingPage==='true';
if(admin){const footer=document.createElement('footer');footer.className='dyws-admin-footer';document.body.append(footer);footer.append(label);}
else (document.querySelector('footer')||document.querySelector('header'))?.append(label);
api.onConnection(mode=>{label.hidden=customer;label.textContent=admin?(mode==='connecting'?'Connecting…':'Live updates'):(mode==='websocket'?'Live connection · WebSocket':mode==='connecting'?'Connecting…':'Live updates · HTTPS polling');label.title=mode==='websocket'?'WebSocket connection':'HTTPS polling';});
window.addEventListener('pagehide',()=>{api.close();if(admin)document.body.hidden=true;});window.addEventListener('pageshow',()=>api.resume());
