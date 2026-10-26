import {configureTimeZone} from './date-time.js';
export function createAPIClient(endpoint,{fetch:fetchRequest=globalThis.fetch}={}) {
 if(!endpoint)throw new TypeError('A DYWS API endpoint is required.');
return async function api(route,{method='GET',body,token,trackingToken,signal,keepalive=false,guest=false,timeoutMs=method==='GET'?15000:0}={}){
 const url=new URL(endpoint);url.searchParams.set('route',route.split('?')[0]);if(route.includes('?'))for(const [k,v] of new URLSearchParams(route.split('?')[1]))url.searchParams.set(k,v);
 const headers={};if(guest)headers['X-DYWS-Guest']='1';if(body!==undefined)headers['Content-Type']='application/json';if(token)headers.Authorization='Bearer '+token;if(trackingToken)headers['X-Tracking-Token']=trackingToken;
 // Bound reads through body consumption so a stalled response cannot hold a refresh loop forever.
 const controller=timeoutMs>0?new AbortController():null;
 const abort=()=>controller.abort(signal.reason);
 if(controller&&signal){if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});}
 const timer=controller?setTimeout(()=>controller.abort(new DOMException('Update timed out. Retrying automatically.','TimeoutError')),timeoutMs):null;
 try{
 const response=await fetchRequest(url,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',referrerPolicy:'no-referrer',signal:controller?.signal||signal,keepalive});
 configureTimeZone(response.headers?.get?.('X-DYWS-Time-Zone'));
 const data=await response.json();if(!response.ok){const error=new Error(data.error||'Request failed.');error.status=response.status;throw error;}return data;
 }finally{clearTimeout(timer);if(controller)signal?.removeEventListener('abort',abort);}
};
}
export const money=(n,currency='CAD')=>new Intl.NumberFormat('en-CA',{style:'currency',currency}).format(n/100);
export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const statusText=s=>s.replaceAll('_',' ');
