// Website endpoint configuration and compatibility exports.
import {createRealtimeAPI} from '../dyws/realtime.js';
export {money,escapeHTML,statusText} from '../dyws/api.js';
export const endpoint=new URL('../api/index.php',import.meta.url);
export const api=createRealtimeAPI(endpoint);

const label=document.createElement('p');label.className='dyws-connection-status';label.setAttribute('role','status');
const admin=document.body.classList.contains('dyws-admin');
if(admin){const footer=document.createElement('footer');footer.className='dyws-admin-footer';document.body.append(footer);footer.append(label);}
else (document.querySelector('footer')||document.querySelector('header'))?.append(label);
api.onConnection(mode=>{label.textContent=admin?(mode==='connecting'?'Connecting…':'Live updates'):(mode==='websocket'?'Live connection · WebSocket':mode==='connecting'?'Connecting…':'Live updates · HTTPS polling');label.title=mode==='websocket'?'WebSocket connection':'HTTPS polling';});
window.addEventListener('pagehide',()=>api.close());window.addEventListener('pageshow',()=>api.resume());
