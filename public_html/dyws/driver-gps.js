/** Foreground GPS for one active delivery or delivery run. No coordinates are stored in browser storage. */
export function createDriverGPS({api,getToken,onState=()=>{},onUnauthorized=()=>{},geolocation=globalThis.navigator?.geolocation,secure=globalThis.isSecureContext,now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout,setRepeater=setInterval,clearRepeater=clearInterval}) {
 let active=null;
 const announce=(s,message,extra={})=>{if(active===s)onState({active:true,orderId:s.id,source:s.source,message,...extra});};
 async function request(route,options){const controller=new AbortController();const timer=setTimer(()=>controller.abort(),15000);try{return await api(route,{...options,signal:controller.signal});}finally{clearTimer(timer);}}
 async function release(s){if(!s?.sharingToken)return;try{await request(s.path+'/location/stop',{method:'POST',token:s.token,keepalive:true,body:{sharingToken:s.sharingToken}});}catch{/* The server expires an unreachable sharing session after two minutes. */}}
 function stop(message='GPS is off.'){const s=active;active=null;if(s){if(s.watch!==null)geolocation?.clearWatch(s.watch);clearTimer(s.timer);clearRepeater(s.refresh);clearRepeater(s.heartbeat);s.pending=null;void release(s);}onState({active:false,message});}
 function accept(s,position){
  if(active!==s)return;
  const p={latitude:position.coords?.latitude,longitude:position.coords?.longitude,accuracy:position.coords?.accuracy,recordedAt:Math.floor(position.timestamp/1000)};
  if(![p.latitude,p.longitude,p.accuracy,p.recordedAt].every(Number.isFinite)||p.latitude< -90||p.latitude>90||p.longitude< -180||p.longitude>180||p.accuracy<0||p.accuracy>5000||p.recordedAt<now()/1000-60||p.recordedAt>now()/1000+30){announce(s,'Waiting for a fresh, usable location fix.');return;}
  if(p.recordedAt<=s.lastRecorded||p.recordedAt<=(s.pending?.recordedAt||0))return;
  s.pending=p;void upload(s);
 }
 async function upload(s){
  if(active!==s||s.busy||!s.pending)return;
  clearTimer(s.timer);const stationary=s.lastPosition&&['latitude','longitude','accuracy'].every(k=>s.lastPosition[k]===s.pending[k]);const delay=Math.max(s.nextAt,stationary?s.lastUploadAt+30000:0)-now();
  if(delay>0){s.timer=setTimer(()=>upload(s),delay);return;}
  const p=s.pending;s.pending=null;
  if(p.recordedAt<now()/1000-60){announce(s,'Waiting for a fresh GPS fix.');return;}
  s.busy=true;
  try{
   await request(s.path+'/location',{method:'POST',token:s.token,body:{...p,sharingToken:s.sharingToken}});
   if(active!==s)return;
   s.lastRecorded=p.recordedAt;s.lastPosition=p;s.lastUploadAt=now();s.failures=0;s.nextAt=now()+5000;
   announce(s,(s.source==='simulated'?'Simulated location':'Location')+' shared. Accuracy '+Math.round(p.accuracy)+' m.',{position:p,sharedAt:now()});
  }catch(e){
   if(active!==s)return;
   if([401,403,404].includes(e.status)){stop(e.status===401?'Session expired. Sign in again.':e.message);if(e.status===401)onUnauthorized();return;}
   if(e.status===409||e.status===422){s.lastRecorded=p.recordedAt;announce(s,'Waiting for a newer location fix.');s.nextAt=now()+5000;}
   else {if(!s.pending||s.pending.recordedAt<p.recordedAt)s.pending=p;s.failures++;s.nextAt=now()+Math.min(30000,5000*2**Math.min(s.failures-1,3));announce(s,'Connection interrupted. Retrying the latest location…');}
  }finally{ s.busy=false;if(active===s&&s.pending)void upload(s); }
 }
 function failed(s,error){if(active!==s)return;if(error.code===1)stop('Location permission denied. Allow location in your browser settings, then return to this page.');else announce(s,error.code===3?'GPS timed out. Waiting for a fresh fix…':'Location is temporarily unavailable. Trying again…');}
 async function start(id,{simulatePosition,scope='order'}={}){
  stop();const token=getToken();if(!token){onState({active:false,message:'Sign in before sharing GPS.'});return;}
  if(!simulatePosition&&(!secure||!geolocation)){onState({active:false,message:!secure?'GPS requires a secure HTTPS page.':'This browser does not support GPS.'});return;}
  const s={id,token,path:'/driver/'+(scope==='run'?'runs':'orders')+'/'+id,scope,source:simulatePosition?'simulated':'device',watch:null,refresh:null,timer:null,pending:null,busy:false,nextAt:0,lastRecorded:0,failures:0};active=s;
  announce(s,'Starting location sharing…');
  try{
   const result=await request(s.path+'/location/start',{method:'POST',token,body:{source:s.source}});s.sharingToken=result.sharingToken;
   if(active!==s){void release(s);return;}
   s.heartbeat=setRepeater(async()=>{if(active!==s||s.heartbeatBusy)return;s.heartbeatBusy=true;try{await request(s.path+'/location/heartbeat',{method:'POST',token:s.token,body:{sharingToken:s.sharingToken}});}catch(e){if(active===s&&[401,403,404].includes(e.status)){stop(e.message);if(e.status===401)onUnauthorized();}}finally{s.heartbeatBusy=false;}},30000);
   if(simulatePosition){let step=0;const tick=()=>{const p=simulatePosition(step++);accept(s,{coords:p,timestamp:now()});};tick();s.refresh=setRepeater(tick,5000);}
   else {
    announce(s,'Allow location access when prompted. Waiting for GPS…');
    const options={enableHighAccuracy:true,maximumAge:0,timeout:20000};
    s.watch=geolocation.watchPosition(p=>accept(s,p),e=>failed(s,e),options);
    // A stationary device may not trigger watch callbacks. Request a new fix, never redate an old one.
    s.refresh=setRepeater(()=>{if(active===s)geolocation.getCurrentPosition(p=>accept(s,p),e=>failed(s,e),options);},30000);
   }
  }catch(e){if(active===s){stop(e.message||'Could not start location sharing.');if(e.status===401)onUnauthorized();}}
 }
 return {start,stop,get orderId(){return active?.id||null;},get scope(){return active?.scope||null;},get source(){return active?.source||null;},destroy(){stop();}};
}
