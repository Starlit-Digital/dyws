/** Cancel obsolete searches even when a transport ignores AbortSignal. */
export function createAddressSearch({api,onResults,onStatus,schedule=setTimeout,cancel=clearTimeout,delay=650}){
 let timer=null,controller=null,sequence=0,disposed=false;
 function reset(){sequence++;if(timer!==null)cancel(timer);timer=null;controller?.abort();controller=null;}
 async function search(query){
  reset();const current=sequence;if(disposed)return;
  query=String(query).trim();onResults([]);
  if(query.length<4){onStatus('Enter a street address and city.');return;}
  controller=new AbortController();onStatus('Finding addresses…');
  try{
   const data=await api('/plugins/nominatim/search',{method:'POST',body:{query},signal:controller.signal,timeoutMs:12000});
   if(disposed||current!==sequence)return;
   const rows=Array.isArray(data?.results)?data.results.slice(0,5):[];
   onResults(rows);onStatus(rows.length?'Choose a suggestion, then check the address.':'No match found. You can enter the address manually.');
  }catch{if(!disposed&&current===sequence)onStatus('Address lookup is unavailable. You can enter the address manually.');}
 }
 return {search,queue(query){reset();onResults([]);onStatus('');if(!disposed&&String(query).trim().length>=4)timer=schedule(()=>{void search(query);},delay);},clear(){reset();onResults([]);onStatus('');},destroy(){disposed=true;reset();}};
}
