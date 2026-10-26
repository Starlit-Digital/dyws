import {configureTimeZone} from './date-time.js';
import {createAPIClient} from './api.js';
/** Optional WebSocket RPC and invalidation, with ordinary HTTP and polling when unavailable. */
export function createRealtimeAPI(endpoint,{WebSocket:Socket=globalThis.WebSocket,http=createAPIClient(endpoint),connectTimeout=2500,requestTimeout=25000,config}={}) {
 let socket,connecting,configured=config!==undefined,url=config?.url||null,nextAttempt=0,attempt=0,serial=0,mode='connecting',closed=false;
 const pending=new Map(),subscriptions=new Map(),listeners=new Set();
 const status=value=>{mode=value;listeners.forEach(fn=>fn(value));};
 const id=()=>String(++serial);
 const rejectPending=()=>{for(const request of pending.values())request.reject(new Error('Connection lost. Check the current order before repeating an action.'));pending.clear();};
 function notify(sub,event){Promise.resolve().then(()=>sub.callback(event)).catch(()=>{});}
 function subscribe(sub){if(socket?.readyState===1){socket.send(JSON.stringify({type:'subscribe',id:sub.id,...sub.options}));sub.subscribedAt=Date.now();}}
 async function connect(){
  if(closed||!Socket)return null;if(socket?.readyState===1)return socket;if(connecting)return connecting;if(Date.now()<nextAttempt)return null;
  connecting=(async()=>{
   if(!configured){try{const config=await http('/realtime/config');url=config.url;configured=true;}catch{nextAttempt=Date.now()+30000;status('polling');return null;}}
   if(!url){status('polling');return null;}
   const parsed=new URL(url);if(parsed.protocol!=='wss:'&&!(parsed.protocol==='ws:'&&['localhost','127.0.0.1','[::1]'].includes(parsed.hostname)&&new URL(endpoint).protocol==='http:')){status('polling');return null;}
   return await new Promise(resolve=>{
    let ws;try{ws=new Socket(url);}catch{status('polling');resolve(null);return;}
    socket=ws;const timeout=setTimeout(()=>ws.close(),connectTimeout);
    ws.onopen=()=>{clearTimeout(timeout);attempt=0;status('websocket');for(const sub of subscriptions.values())subscribe(sub);resolve(ws);};
    ws.onerror=()=>{try{ws.close();}catch{}};
    ws.onclose=()=>{clearTimeout(timeout);if(socket===ws){socket=null;rejectPending();status('polling');nextAttempt=Date.now()+Math.min(30000,1000*2**Math.min(attempt++,5));}resolve(null);};
    ws.onmessage=event=>{
     let m;try{m=JSON.parse(event.data);}catch{return;}
     if(m.type==='response'){configureTimeZone(m.timeZone);const request=pending.get(m.id);if(!request)return;pending.delete(m.id);if(m.status>=200&&m.status<300)request.resolve(m.data);else request.reject(Object.assign(new Error(m.data?.error||'Request failed.'),{status:m.status}));}
     else {const sub=subscriptions.get(m.subscription);if(!sub)return;
      if(m.type==='subscribed'){notify(sub,{type:sub.revision!==undefined&&sub.revision!==m.revision?'change':'sync'});sub.revision=m.revision;}
      if(m.type==='change')notify(sub,{type:'change'});
      if(m.type==='subscription-error')notify(sub,{type:'auth-error',status:m.status});
     }
    };
   });
  })().catch(()=>{status('polling');return null;}).finally(()=>{connecting=null;});return connecting;
 }
 async function api(route,options={}) {
  if(options.keepalive||options.guest)return http(route,options);
  const ws=await connect();if(options.signal?.aborted)throw new DOMException('Request aborted.','AbortError');
  if(!ws||ws.readyState!==1)return http(route,options);
  try{return await new Promise((resolve,reject)=>{
   const requestId=id();let timer;
   const cleanup=()=>{clearTimeout(timer);options.signal?.removeEventListener('abort',abort);pending.delete(requestId);};
   const abort=()=>{cleanup();reject(new DOMException('Request aborted.','AbortError'));};
   pending.set(requestId,{resolve:value=>{cleanup();resolve(value);},reject:error=>{cleanup();reject(error);}});
   timer=setTimeout(()=>{cleanup();reject(new Error('Connection timed out. Check the current order before repeating an action.'));ws.close();},requestTimeout);
   options.signal?.addEventListener('abort',abort,{once:true});
   try{ws.send(JSON.stringify({type:'request',id:requestId,route,method:options.method||'GET',body:options.body,token:options.token,trackingToken:options.trackingToken}));}catch(e){cleanup();reject(e);}
  });}catch(error){
   // Reads are safe to retry. Never automatically repeat an uncertain mutation.
   if((options.method||'GET')==='GET'&&!error.status&&!options.signal?.aborted)return http(route,options);
   throw error;
  }
 }
 api.watch=(options,callback)=>{
  const {interval=10000,...access}=options,sub={id:id(),options:access,callback,revision:undefined,subscribedAt:0,busy:false};subscriptions.set(sub.id,sub);
  const tick=async()=>{if(sub.busy||!subscriptions.has(sub.id))return;sub.busy=true;try{
   const ws=await connect();if(!subscriptions.has(sub.id))return;
   if(ws?.readyState===1){if(Date.now()-sub.subscribedAt>25000)subscribe(sub);}
   else {const data=await http('/realtime/access',{method:'POST',body:{scope:access.scope||'public',orderId:access.orderId},token:access.token,trackingToken:access.trackingToken,timeoutMs:15000});sub.revision=data.revision;notify(sub,{type:'poll'});}
  }catch(e){notify(sub,{type:'auth-error',status:e.status});}finally{sub.busy=false;}};
  void tick();const timer=setInterval(tick,interval);
  return ()=>{clearInterval(timer);subscriptions.delete(sub.id);if(socket?.readyState===1)socket.send(JSON.stringify({type:'unsubscribe',id:sub.id}));};
 };
 api.onConnection=fn=>{listeners.add(fn);fn(mode);return ()=>listeners.delete(fn);};
 api.close=()=>{closed=true;socket?.close();rejectPending();status('polling');};
 api.resume=()=>{closed=false;nextAttempt=0;void connect();};
 Object.defineProperty(api,'transport',{get:()=>mode});
 void connect();return api;
}
