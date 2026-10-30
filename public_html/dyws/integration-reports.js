/** Scoped machine reporting only. Credentials remain in memory; no generic mutation retry. */
export function createIntegrationReportClient(endpoint,{
 token,fetch:fetchRequest=globalThis.fetch,forcePost=false,onMetric=()=>{},
 timeoutMs=15000,capabilityTtlMs=300000,now=()=>Date.now()
}={}){
 const base=new URL(endpoint);
 if(!token)throw new TypeError('An integration bearer key is required.');
 if(base.protocol!=='https:'&&!(base.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(base.hostname)))throw new TypeError('Integration reports require HTTPS outside loopback.');
 if(base.username||base.password)throw new TypeError('Do not put credentials in the endpoint.');
 if(!Number.isFinite(timeoutMs)||timeoutMs<=0||!Number.isFinite(capabilityTtlMs)||capabilityTtlMs<=0)throw new TypeError('Positive finite timeout and capability lifetime required.');
 let preferred='POST',expires=0,postOnly=Boolean(forcePost);
 const route='/integrations/v1/commands/reports.summary';
 const metric=value=>{try{onMetric(Object.freeze(value));}catch{/* Observation must not change request behavior. */}};
 function url(execute){const value=new URL(base);value.searchParams.set('route',route+(execute?'/execute':''));return value;}
 return {
  setForcePost(value){postOnly=Boolean(value);},
  async summary(filters={}, {signal}={}){
   // Snapshot once so fallback cannot send a different body after caller mutation.
   const body=JSON.stringify(filters),started=now(),controller=new AbortController();
   const abort=()=>controller.abort(signal.reason);
   if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
   const timer=setTimeout(()=>controller.abort(new DOMException('Report request timed out.','TimeoutError')),timeoutMs);
   let attempts=0,method='POST',fallback=false;
   const send=async(method,execute)=>{
    controller.signal.throwIfAborted();
    return fetchRequest(url(execute),{method,headers:{Authorization:'Bearer '+token,Accept:'application/json',...(execute?{'Content-Type':'application/json'}:{})},...(execute?{body}:{}),cache:'no-store',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:controller.signal});
   };
   const decode=async response=>{
    let data;try{data=await response.json();}catch(error){controller.signal.throwIfAborted();if(response.ok)throw new Error('Invalid report response.');}
    controller.signal.throwIfAborted();
    if(!response.ok){const error=new Error(data?.error||'Integration report request failed.');error.status=response.status;throw error;}return data;
   };
   try{
    if(!postOnly&&expires<=now()){
     const definition=await decode(await send('GET',false));
     const transport=definition.transport;
     preferred=definition.id==='reports.summary'&&definition.readOnly===true&&transport?.version===1&&transport.preferredMethod==='QUERY'&&transport.fallbackMethod==='POST'&&transport.supportedMethods?.includes('QUERY')&&transport.supportedMethods?.includes('POST')?'QUERY':'POST';
     expires=now()+capabilityTtlMs;
    }
    method=postOnly?'POST':preferred;
    attempts++;let response=await send(method,true);
    metric({event:'attempt',method,status:response.status,elapsedMs:now()-started});
    if(method==='QUERY'&&[405,501].includes(response.status)){
     preferred='POST';expires=now()+capabilityTtlMs;fallback=true;
     // Unsupported servers may send HTML, so inspect status before decoding.
     await response.body?.cancel();
     method='POST';attempts++;response=await send(method,true);
     metric({event:'attempt',method:'POST',status:response.status,elapsedMs:now()-started});
    }
    const result=await decode(response);
    metric({event:'result',method,fallback,attempts,status:response.status,ok:true,elapsedMs:now()-started});
    return result;
   }catch(error){metric({event:'result',method,fallback,attempts,status:error.status??null,ok:false,elapsedMs:now()-started});throw error;
   }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
  }
 };
}
