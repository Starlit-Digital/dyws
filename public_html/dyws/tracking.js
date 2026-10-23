import {statusText,escapeHTML} from './api.js';
export function createTracking({api,container,trackingPage,renderLocation,storageKey='starlit-go-tracking',panelId='customer-tracking'}) {
 if(typeof api!=='function'||!container)throw new TypeError('DYWS tracking requires an API client and container.');
 let timer,active,panel;
const labels={placed:'Order placed',accepted:'Order accepted',preparing:'Preparing your order',ready:'Ready',out_for_delivery:'Driver on the way',delivered:'Delivered',completed:'Collected',cancelled:'Cancelled'};
function show(id,token){
 active={id,token};try{sessionStorage.setItem(storageKey,JSON.stringify(active));}catch{}
 if(!panel){panel=document.createElement('section');panel.id=panelId;panel.className='dyws-tracking-panel';container.prepend(panel);}panel.setAttribute('aria-label','Your order tracking');
 panel.innerHTML=`<h2>Your test order</h2><p>Reference <strong>${escapeHTML(id)}</strong></p><p class="dyws-tracking-status" role="status">Connecting…</p><ol class="dyws-tracking-timeline"></ol><div class="dyws-tracking-payment"></div><div class="dyws-tracking-gps"></div><p>Updates appear here automatically. Keep this page open.</p>${trackingPage?`<p><a class="dyws-tracking-link" href="${escapeHTML(trackingPage)}#${encodeURIComponent(id)}.${encodeURIComponent(token)}">Open private tracking page ↗</a></p>`:''}<p class="dyws-tracking-error" role="alert"></p><button class="dyws-dismiss-tracking" type="button">Hide tracking</button>`;
 panel.querySelector('.dyws-dismiss-tracking').onclick=()=>{destroy();try{sessionStorage.removeItem(storageKey);}catch{}};
 clearTimeout(timer);poll();
}
async function poll(){
 const current=active;if(!current)return;
 try{
  const data=await api('/tracking/'+current.id,{trackingToken:current.token});if(active!==current)return;
  if(!panel)return;
  panel.querySelector('.dyws-tracking-status').textContent=labels[data.status]||statusText(data.status);panel.querySelector('.dyws-tracking-error').textContent='';
  panel.querySelector('.dyws-tracking-timeline').innerHTML=data.events.filter(e=>labels[e.status]).map(e=>`<li>${escapeHTML(labels[e.status])} <small>${new Date(e.created_at*1000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</small></li>`).join('');
  const payment=panel.querySelector('.dyws-tracking-payment');
  if(!payment.querySelector('button:disabled')){
   payment.replaceChildren();const label=document.createElement('p');label.textContent='Payment: '+statusText(data.paymentStatus);payment.append(label);
   if(data.paymentProvider==='stripe'&&data.paymentStatus==='unpaid'&&data.status==='placed'){
    if(!data.checkoutStatus||['creating','open'].includes(data.checkoutStatus)){
     const pay=document.createElement('button');pay.textContent='Pay with Stripe · test checkout';payment.append(pay);
     pay.onclick=async()=>{pay.disabled=true;try{const result=await api('/orders/'+current.id+'/checkout',{method:'POST',body:{},trackingToken:current.token});const url=new URL(result.url);if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com')throw new Error('Invalid payment link.');location.assign(url.href);}catch(e){panel.querySelector('.dyws-tracking-error').textContent=e.message;pay.disabled=false;}};
    }else{const note=document.createElement('p');note.textContent=data.checkoutStatus==='pending'?'Waiting for Stripe to confirm payment. Do not place a duplicate order.':'Checkout '+data.checkoutStatus+'. Contact the business if you need help.';payment.append(note);}
   }
  }
  const gps=panel.querySelector('.dyws-tracking-gps');
  if(data.location){const l=data.location;gps.innerHTML=`<h3>${data.gpsStale?'Last known driver location':'Driver location'}</h3><p>${escapeHTML(Number(l.latitude).toFixed(5))}, ${escapeHTML(Number(l.longitude).toFixed(5))} · accuracy ${Math.round(l.accuracy)} m · updated ${new Date(l.recorded_at*1000).toLocaleTimeString()}</p>${data.gpsStale?'<p>GPS updates are delayed. This position may have changed.</p>':''}`;if(renderLocation){const map=renderLocation(l);if(map)gps.append(map);}}
  else gps.innerHTML=data.status==='out_for_delivery'?'<p>Waiting for the driver’s GPS update…</p>':'<p>Driver location is shared only while your delivery is on the way.</p>';
  if(['completed','delivered','cancelled'].includes(data.status))return;
 }catch(e){if(active!==current)return;const error=panel?.querySelector('.dyws-tracking-error');if(error)error.textContent=e.message+' Retrying shortly.';}
 timer=setTimeout(poll,document.hidden?30000:5000);
}
function destroy(){clearTimeout(timer);active=null;panel?.remove();panel=null;}
function restore(){try{const saved=JSON.parse(sessionStorage.getItem(storageKey));if(saved?.id&&saved?.token)show(saved.id,saved.token);}catch{}}
return {show,restore,destroy,scrollIntoView(){panel?.scrollIntoView({behavior:'smooth',block:'start'});}};
}
