// Website endpoint configuration and compatibility exports.
import {createRealtimeAPI} from '../dyws/realtime.js';
export {money,escapeHTML,statusText} from '../dyws/api.js';
export const endpoint=new URL('../api/index.php',import.meta.url);
export const api=createRealtimeAPI(endpoint);

const label=document.createElement('p');label.className='dyws-connection-status';label.setAttribute('role','status');
(document.querySelector('footer')||document.querySelector('header'))?.append(label);
api.onConnection(mode=>{label.textContent=mode==='websocket'?'Live connection · WebSocket':mode==='connecting'?'Connecting…':'Live updates · HTTPS polling';});
window.addEventListener('pagehide',()=>api.close());window.addEventListener('pageshow',()=>api.resume());
