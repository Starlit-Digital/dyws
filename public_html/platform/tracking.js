import {api,statusText,escapeHTML} from './api.js';
let timer,active;
const labels={placed:'Order placed',accepted:'Order accepted',preparing:'Preparing your order',ready:'Ready',out_for_delivery:'Driver on the way',delivered:'Delivered',completed:'Collected',cancelled:'Cancelled'};
export function showTracking(id,token){
 active={id,token};try{sessionStorage.setItem('starlit-go-tracking',JSON.stringify(active));}catch{}
 let panel=document.querySelector('#customer-tracking');if(!panel){panel=document.createElement('section');panel.id='customer-tracking';panel.className='tracking-panel';document.querySelector('main').prepend(panel);}panel.setAttribute('aria-label','Your order tracking');
 panel.innerHTML=`<h2>Your test order</h2><p>Reference <strong>${escapeHTML(id)}</strong></p><p class="tracking-status" role="status">Connecting…</p><ol class="tracking-timeline"></ol><div class="tracking-payment"></div><div class="tracking-gps"></div><p>Updates appear here automatically. Keep this page open.</p><p><a class="tracking-link" href="tracking.html#${encodeURIComponent(id)}.${encodeURIComponent(token)}">Open private tracking page ↗</a></p><p class="tracking-error" role="alert"></p><button class="dismiss-tracking" type="button">Hide tracking</button>`;
 panel.querySelector('.dismiss-tracking').onclick=()=>{clearTimeout(timer);active=null;panel.remove();try{sessionStorage.removeItem('starlit-go-tracking');}catch{}};
 clearTimeout(timer);poll();
}
function project(lat,lon){const world=256*2**15;const toX=l=>(l+180)/360*world;const toY=l=>(1-Math.log(Math.tan(l*Math.PI/180)+1/Math.cos(l*Math.PI/180))/Math.PI)/2*world;return {x:toX(lon)-toX(-113.3980424)+640,y:toY(lat)-toY(53.6166525)+200};}
async function poll(){
 const current=active;if(!current)return;
 try{
  const data=await api('/tracking/'+current.id,{trackingToken:current.token});if(active!==current)return;
  const panel=document.querySelector('#customer-tracking');if(!panel)return;
  panel.querySelector('.tracking-status').textContent=labels[data.status]||statusText(data.status);panel.querySelector('.tracking-error').textContent='';
  panel.querySelector('.tracking-timeline').innerHTML=data.events.filter(e=>labels[e.status]).map(e=>`<li>${escapeHTML(labels[e.status])} <small>${new Date(e.created_at*1000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</small></li>`).join('');
  const payment=panel.querySelector('.tracking-payment');
  if(!payment.querySelector('button:disabled')){
   payment.replaceChildren();const label=document.createElement('p');label.textContent='Payment: '+statusText(data.paymentStatus);payment.append(label);
   if(data.paymentProvider==='stripe'&&data.paymentStatus==='unpaid'&&data.status==='placed'){
    if(!data.checkoutStatus||['creating','open'].includes(data.checkoutStatus)){
     const pay=document.createElement('button');pay.textContent='Pay with Stripe · test checkout';payment.append(pay);
     pay.onclick=async()=>{pay.disabled=true;try{const result=await api('/orders/'+current.id+'/checkout',{method:'POST',body:{},trackingToken:current.token});const url=new URL(result.url);if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com')throw new Error('Invalid payment link.');location.assign(url.href);}catch(e){panel.querySelector('.tracking-error').textContent=e.message;pay.disabled=false;}};
    }else{const note=document.createElement('p');note.textContent=data.checkoutStatus==='pending'?'Waiting for Stripe to confirm payment. Do not place a duplicate order.':'Checkout '+data.checkoutStatus+'. Contact the business if you need help.';payment.append(note);}
   }
  }
  const gps=panel.querySelector('.tracking-gps');
  if(data.location){const l=data.location,p=project(l.latitude,l.longitude),within=p.x>=0&&p.x<=1280&&p.y>=0&&p.y<=560;gps.innerHTML=`<h3>${data.gpsStale?'Last known driver location':'Driver location'}</h3><p>${escapeHTML(Number(l.latitude).toFixed(5))}, ${escapeHTML(Number(l.longitude).toFixed(5))} · accuracy ${Math.round(l.accuracy)} m · updated ${new Date(l.recorded_at*1000).toLocaleTimeString()}</p>${within?`<svg class="driver-map" viewBox="0 0 1280 560" role="img" aria-label="Approximate driver position on the Manning area reference map"><image href="images/manning-area-map.png" width="1280" height="560"/><circle cx="${p.x}" cy="${p.y}" r="24" fill="#b52e37" stroke="white" stroke-width="8"/><text x="${Math.max(80,Math.min(1150,p.x))}" y="${Math.max(40,p.y-40)}" text-anchor="middle" fill="#202124" stroke="#fff8ed" stroke-width="8" paint-order="stroke" font-size="32" font-weight="bold">Driver</text></svg><p class="note">Approximate position on a reference map. No route or arrival time is calculated.</p>`:'<p>The driver is outside this demo map area. The latest GPS coordinates are shown above.</p>'}${data.gpsStale?'<p>GPS updates are delayed. This position may have changed.</p>':''}`;}
  else gps.innerHTML=data.status==='out_for_delivery'?'<p>Waiting for the driver’s GPS update…</p>':'<p>Driver location is shared only while your delivery is on the way.</p>';
  if(['completed','delivered','cancelled'].includes(data.status))return;
 }catch(e){if(active!==current)return;const error=document.querySelector('.tracking-error');if(error)error.textContent=e.message+' Retrying shortly.';}
 timer=setTimeout(poll,document.hidden?30000:5000);
}
if(document.body.dataset.trackingPage==='true'){
 const [id,token]=location.hash.slice(1).split('.').map(decodeURIComponent);if(id&&token)showTracking(id,token);else document.querySelector('main').insertAdjacentHTML('beforeend','<p>Use the private tracking link from your order confirmation.</p>');
}else {try{const saved=JSON.parse(sessionStorage.getItem('starlit-go-tracking'));if(saved?.id&&saved?.token)showTracking(saved.id,saved.token);}catch{}}
