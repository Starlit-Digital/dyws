export const endpoint=new URL('../api/index.php',import.meta.url);
export async function api(route,{method='GET',body,token,trackingToken}={}){
 const url=new URL(endpoint);url.searchParams.set('route',route.split('?')[0]);if(route.includes('?'))for(const [k,v] of new URLSearchParams(route.split('?')[1]))url.searchParams.set(k,v);
 const headers={};if(body!==undefined)headers['Content-Type']='application/json';if(token)headers.Authorization='Bearer '+token;if(trackingToken)headers['X-Tracking-Token']=trackingToken;
 const response=await fetch(url,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',referrerPolicy:'no-referrer'});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'Request failed.');return data;
}
export const money=n=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(n/100);
export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const statusText=s=>s.replaceAll('_',' ');
