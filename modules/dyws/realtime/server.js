import http from 'node:http';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {WebSocketServer,WebSocket} from 'ws';

export function createRealtimeServer({backend,secret,origins,host='127.0.0.1',port=8099,path='/dyws',trustProxy=false,fetchRequest=fetch}) {
 if(!backend||!secret||secret.length<32||!origins?.length)throw new Error('Configure the backend, secret and allowed origins.');
 const target=new URL(backend);if(target.protocol!=='https:'&&!(target.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(target.hostname)))throw new Error('The backend requires HTTPS, except on loopback.');
 const equal=value=>{const a=Buffer.from(String(value||'')),b=Buffer.from(secret);return a.length===b.length&&timingSafeEqual(a,b);};
 const clients=new Set();
 const broadcast=channels=>{for(const ws of clients){if(ws.readyState!==WebSocket.OPEN)continue;for(const [id,sub] of ws.subs)if(sub.expiresAt>Date.now()/1000&&channels.some(c=>sub.channels.includes(c)))ws.send(JSON.stringify({type:'change',subscription:id}));}};
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
  if(req.method==='GET'&&req.url==='/health'){res.end('{"service":"DYWS realtime","ok":true}');return;}
  if(req.method!=='POST'||req.url!=='/publish'||!equal(req.headers['x-dyws-relay-key'])){res.writeHead(404);res.end('{}');return;}
  try{let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>4096)throw new Error();}const {channels}=JSON.parse(body);if(!Array.isArray(channels)||channels.length>20||!channels.every(c=>typeof c==='string'&&c.length<200))throw new Error();broadcast(channels);res.end('{"ok":true}');}catch{res.writeHead(400);res.end('{}');}
 });
 const wss=new WebSocketServer({noServer:true,maxPayload:300000,perMessageDeflate:false});
 server.on('upgrade',(req,socket,head)=>{
  if(req.url!==path||!origins.includes(req.headers.origin)||clients.size>=500){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}
  wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
 });
 async function forward(message,client){
  if(typeof message.route!=='string'||!/^\/[a-zA-Z0-9/?=&_%.-]{1,300}$/.test(message.route)||!['GET','POST'].includes(message.method||'GET'))throw Object.assign(new Error('Invalid API request.'),{status:400});
  const url=new URL(target);const [route,query='']=message.route.split('?');url.searchParams.set('route',route);for(const [k,v]of new URLSearchParams(query))if(k!=='route')url.searchParams.set(k,v);
  const headers={'Content-Type':'application/json','X-DYWS-Relay-Key':secret,'X-DYWS-Client':client};
  if(message.token){if(!/^[a-f0-9]{64}$/.test(message.token))throw Object.assign(new Error('Invalid session.'),{status:401});headers.Authorization='Bearer '+message.token;}
  if(message.trackingToken){if(!/^[a-f0-9]{64}$/.test(message.trackingToken))throw Object.assign(new Error('Invalid tracking link.'),{status:404});headers['X-Tracking-Token']=message.trackingToken;}
  const response=await fetchRequest(url,{method:message.method||'GET',headers,body:message.method==='POST'?JSON.stringify(message.body||{}):undefined,signal:AbortSignal.timeout(20000),redirect:'error'});
  const data=await response.json();let topics=[];try{topics=JSON.parse(response.headers.get('x-dyws-events')||'[]');}catch{}
  if(response.ok&&Array.isArray(topics))broadcast(topics.filter(t=>typeof t==='string'));
  return {status:response.status,data,timeZone:response.headers.get('x-dyws-time-zone')};
 }
 wss.on('connection',(ws,req)=>{
  ws.subs=new Map();ws.alive=true;ws.inflight=0;ws.messages=0;ws.window=Date.now();clients.add(ws);
  const peer=trustProxy&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)?String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',')[0].trim():req.socket.remoteAddress;
  ws.client=createHmac('sha256',secret).update(peer||'unknown').digest('hex');
  ws.on('pong',()=>{ws.alive=true;});ws.on('error',()=>{});ws.on('close',()=>clients.delete(ws));
  ws.on('message',async(bytes,binary)=>{
   if(Date.now()-ws.window>60000){ws.window=Date.now();ws.messages=0;}
   if(binary||++ws.messages>240||ws.inflight>=8){ws.close(1008,'Request limit');return;}
   let m;try{m=JSON.parse(bytes.toString());if(!m||typeof m.id!=='string'||!/^\w{1,80}$/.test(m.id))throw new Error();}catch{ws.close(1008,'Invalid message');return;}
   if(m.type==='unsubscribe'){ws.subs.delete(m.id);return;}
   ws.inflight++;
   try{
    if(m.type==='subscribe'){
     if(ws.subs.size>=8&&!ws.subs.has(m.id))throw Object.assign(new Error('Too many subscriptions.'),{status:429});
     const result=await forward({route:'/realtime/access',method:'POST',body:{scope:m.scope,orderId:m.orderId},token:m.token,trackingToken:m.trackingToken},ws.client);
     if(result.status!==200){ws.subs.delete(m.id);if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'subscription-error',subscription:m.id,status:result.status}));return;}
     ws.subs.set(m.id,result.data);if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'subscribed',subscription:m.id,revision:result.data.revision}));
    }else if(m.type==='request'){
     const result=await forward(m,ws.client);if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'response',id:m.id,...result}));
    }else throw Object.assign(new Error('Invalid message type.'),{status:400});
   }catch(e){if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'response',id:m.id,status:e.status||502,data:{error:e.status?e.message:'The backend connection failed. Check the current order before repeating an action.'}}));}
   finally{ws.inflight--;}
  });
 });
 const heartbeat=setInterval(()=>{for(const ws of clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}},25000);heartbeat.unref();
 return {server,wss,listen:()=>new Promise(resolve=>server.listen(port,host,resolve)),close:()=>new Promise(resolve=>{clearInterval(heartbeat);for(const ws of clients)ws.terminate();wss.close(()=>server.close(resolve));})};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const service=createRealtimeServer({backend:process.env.DYWS_BACKEND_URL,secret:process.env.DYWS_REALTIME_SECRET,origins:(process.env.DYWS_ORIGINS||'').split(',').filter(Boolean),host:process.env.HOST||'127.0.0.1',port:Number(process.env.PORT||8099),trustProxy:process.env.DYWS_TRUST_PROXY==='true'});
 await service.listen();console.log('DYWS realtime listening');for(const signal of ['SIGTERM','SIGINT'])process.on(signal,async()=>{await service.close();process.exit(0);});
}
