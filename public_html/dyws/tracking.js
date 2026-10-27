import {driverIconImage} from './driver-icons.js';
import {statusBadge} from './status-badge.js';
import {formatTime} from './date-time.js';
import {pluginSlot} from './plugin-ui.js?v=39';
import {statusText,escapeHTML} from './api.js';
import {trackingDetails} from './tracking-details.js';
import {defaultRole} from './role-labels.js';
import {deliveryStatus,terminalStatuses} from './delivery-status.js?v=40';
export function createTracking({api,container,role=defaultRole,trackingPage,renderLocation,renderPayment,plugins,shopPage,storageKey='dyws-tracking',panelId='customer-tracking',document:doc=globalThis.document,now=Date.now,onReady=()=>{}}) {
 if(typeof api!=='function'||!container)throw new TypeError('dyws tracking requires an API client and container.');
 let timer,clock,active,panel,unwatch=null,polling=false,again=false,lastData,estimate,unavailable=false,lastChecked=0,lastAnnouncement='',paymentState='';
 const refreshWhenVisible=()=>{if(!doc.hidden)void poll();};
 function listen(){doc.addEventListener?.('visibilitychange',refreshWhenVisible);doc.defaultView?.addEventListener('online',refreshWhenVisible);}
 function unlisten(){doc.removeEventListener?.('visibilitychange',refreshWhenVisible);doc.defaultView?.removeEventListener('online',refreshWhenVisible);}
 const time=value=>formatTime(value);
 function write(selector,text){const node=panel?.querySelector(selector);if(node&&node.textContent!==text)node.textContent=text;}
 function html(selector,value){const node=panel.querySelector(selector);if(node.innerHTML!==value)node.innerHTML=value;}
 function announce(key,text){if(lastAnnouncement!==key){lastAnnouncement=key;write('.dyws-tracking-announcement',text);}}
 function summary(){
  if(!panel||!lastData)return;
  const delayed=unavailable||now()-lastChecked>15000;
  const view=deliveryStatus(lastData,{estimate,now:now(),role:role.singular,unavailable:delayed});
  panel.dataset.status=lastData.status;
  panel.dataset.pending=String(view.pending);
  panel.querySelector('.dyws-pending-indicator').hidden=!view.pending;
  write('.dyws-tracking-kind',lastData.fulfillmentMeta?.label||(lastData.fulfillment==='pickup'?'Pickup':'Delivery'));
  write('.dyws-tracking-status',view.title);write('.dyws-tracking-message',view.message);
  const arrival=panel.querySelector('.dyws-tracking-arrival');arrival.hidden=view.terminal;
  write('.dyws-arrival-label',view.etaTitle);write('.dyws-arrival-value',view.etaValue);write('.dyws-arrival-detail',view.etaDetail);
  const stages=panel.querySelector('.dyws-tracking-timeline');stages.hidden=lastData.status==='cancelled';
  const html=view.stages.map((step,index)=>{
   const done=step.state==='done'||(view.complete&&step.state==='current');
   return `<li class="dyws-step-${done?'done':step.state}" ${step.state==='current'?'aria-current="step"':''}><span class="dyws-step-marker" aria-hidden="true">${done?'✓':index+1}</span><span class="dyws-step-label">${escapeHTML(step.label)}<small>${done?'Complete':step.state==='current'?'Current':'Upcoming'}</small></span></li>`;
  }).join('');
  if(stages.innerHTML!==html)stages.innerHTML=html;
  write('.dyws-tracking-updated',view.terminal?(view.title+' at '+time(view.stamp)):delayed?'Updates delayed. Reconnecting…':'Checked '+time(lastChecked/1000));
  panel.querySelector('.dyws-tracking-complete').hidden=!view.complete;
  // Clock ticks and route timestamps are visual only. Announce meaningful changes once.
  const driver=[lastData.driver?.name,lastData.driver?.vehicleColor,lastData.driver?.vehicleType].filter(Boolean).join(', ');
  const key=JSON.stringify([lastData.status,lastData.paymentStatus,delayed,view.etaTitle,view.etaValue,driver]);
  announce(key,[view.title+'.',view.message,view.terminal?'':view.etaValue+'. '+view.etaDetail,lastData.paymentStatus?'Payment '+statusText(lastData.paymentStatus)+'.':'',driver?role.singular+': '+driver+'.':''].filter(Boolean).join(' '));
 }
 function show(id,token){
  renderLocation?.clear?.();lastData=null;estimate=undefined;unavailable=false;lastChecked=0;lastAnnouncement='';paymentState='';
  active={id,token};try{sessionStorage.setItem(storageKey,JSON.stringify(active));}catch{}
  if(!panel){panel=doc.createElement('section');panel.id=panelId;panel.className='dyws-tracking-panel';container.prepend(panel);}panel.setAttribute('aria-label','Your order tracking');
  const heading=shopPage?'h1':'h2';
  panel.innerHTML=`<p class="dyws-tracking-announcement dyws-visually-hidden" role="status" aria-live="polite" aria-atomic="true"></p>
   <div class="dyws-tracking-meta"><p class="dyws-tracking-reference">Order <strong>${escapeHTML(id)}</strong></p><span class="dyws-tracking-kind"></span></div>
   <div class="dyws-tracking-heading"><${heading} class="dyws-tracking-status">Connecting…</${heading}><p class="dyws-tracking-message"></p></div>
   <div class="dyws-tracking-arrival"><div class="dyws-pending-indicator" aria-hidden="true" hidden><svg viewBox="0 0 48 48" focusable="false"><circle cx="24" cy="24" r="17"/><path d="M24 14v11l7 4"/></svg><span></span><span></span><span></span></div><p class="dyws-arrival-label">Order status</p><strong class="dyws-arrival-value">Checking your order</strong><p class="dyws-arrival-detail"></p></div>
   <p class="dyws-tracking-updated dyws-note"></p><ol class="dyws-tracking-timeline" aria-label="Order progress"></ol><p class="dyws-tracking-complete" hidden>Order complete.</p>
   <div class="dyws-tracking-driver" hidden><span class="dyws-tracking-driver-icon"></span><p class="dyws-driver-label"></p><strong class="dyws-driver-name"></strong><p class="dyws-driver-vehicle"></p></div><div class="dyws-tracking-gps"></div><div class="dyws-tracking-map"></div>
   <div class="dyws-tracking-details" hidden><h2 class="dyws-visually-hidden">Order details</h2><article class="dyws-tracking-receipt"></article><div class="dyws-tracking-service"><div class="dyws-tracking-fulfillment-details"></div><div class="dyws-tracking-payment"></div><div class="dyws-tracking-help"></div></div></div>
   ${trackingPage?`<p><a class="dyws-tracking-link" href="${escapeHTML(trackingPage)}#${encodeURIComponent(id)}.${encodeURIComponent(token)}">Track order</a></p>`:''}<p class="dyws-tracking-error" role="alert"></p>${shopPage?`<a class="dyws-tracking-return" href="${escapeHTML(shopPage)}">Back to menu</a>`:'<button class="dyws-dismiss-tracking" type="button">Hide tracking</button>'}`;
  panel.dataset.pending='false';
  const dismiss=panel.querySelector('.dyws-dismiss-tracking');if(dismiss)dismiss.onclick=()=>{destroy();try{sessionStorage.removeItem(storageKey);}catch{}};
  clearTimeout(timer);clearInterval(clock);clock=setInterval(summary,10000);listen();
  unwatch?.();unwatch=api.watch?.({scope:'tracking',orderId:id,trackingToken:token,interval:5000},()=>poll());void poll();
 }
 async function poll(){
  const current=active;if(!current||terminalStatuses.has(lastData?.status))return;if(polling){again=true;return;}polling=true;
  try{
   const data=await api('/tracking/'+current.id,{trackingToken:current.token});if(active!==current||!panel)return;
   lastData=data;lastChecked=now();unavailable=false;write('.dyws-tracking-error','');summary();
   const details=trackingDetails(data);html('.dyws-tracking-receipt',details.receipt);html('.dyws-tracking-fulfillment-details',details.fulfillment);html('.dyws-tracking-help',details.help);
   panel.querySelector('.dyws-tracking-receipt').hidden=!details.receipt;panel.querySelector('.dyws-tracking-details').hidden=false;
  const driver=panel.querySelector('.dyws-tracking-driver');driver.hidden=!data.driver;
  html('.dyws-tracking-driver-icon',data.driver?driverIconImage(data.driver.profileIcon):'');
  write('.dyws-driver-label',role.singular);write('.dyws-driver-name',data.driver?.name||'');
  const vehicle=[data.driver?.vehicleColor,data.driver?.vehicleType].filter(Boolean).join(' · ');write('.dyws-driver-vehicle',vehicle);panel.querySelector('.dyws-driver-vehicle').hidden=!vehicle;
  const payment=panel.querySelector('.dyws-tracking-payment');
  const nextPaymentState=JSON.stringify([data.paymentProvider,data.paymentStatus,data.status]);
  if(paymentState!==nextPaymentState&&!payment.querySelector('button:disabled')){
   paymentState=nextPaymentState;
   payment.replaceChildren();const label=doc.createElement('p');label.className='dyws-status-row';label.innerHTML='Payment '+statusBadge(data.paymentStatus);payment.append(label);
   if(data.paymentProvider!=='demo'&&data.paymentStatus==='unpaid'&&data.status==='placed'){
    if(renderPayment)renderPayment({order:data,container:payment,trackingToken:current.token,onError:message=>write('.dyws-tracking-error',message)});
    else{const note=doc.createElement('p');note.textContent='Online payment is unavailable. Contact the business for help with this order.';payment.append(note);}
   }
  }
   const gps=panel.querySelector('.dyws-tracking-gps');
   if(data.location&&data.status==='out_for_delivery'){
    const l=data.location,stale=data.gpsStale||now()-l.recorded_at*1000>60000;
    gps.innerHTML=`<p>${data.locationSource==='simulated'?'Simulated location · ':''}${escapeHTML(stale?'Last known '+role.singular.toLowerCase()+' location':role.singular+' location')} · updated ${time(l.recorded_at)}</p>${stale?'<p>Location updates are delayed. The position may have changed.</p>':''}`;
    if(renderLocation){const map=renderLocation(l,role,{profileIcon:data.driver?.profileIcon,destinationAddress:data.deliveryRun?.stopsAhead>0?undefined:data.deliveryAddress,onEstimate:value=>{if(active!==current||lastData!==data||terminalStatuses.has(data.status))return;estimate=value;summary();}});const mapRoot=panel.querySelector('.dyws-tracking-map');if(map&&!mapRoot.contains(map))mapRoot.replaceChildren(map);}
    else {estimate=null;summary();}
   }else{
    renderLocation?.clear?.();estimate=undefined;panel.querySelector('.dyws-tracking-map').replaceChildren();
    gps.innerHTML=data.status==='out_for_delivery'?'<p>Waiting for the next location update.</p>':'';
   }
   if(plugins)void plugins.runAction('tracking:updated',{root:pluginSlot(panel,'tracking'),order:data});
   if(terminalStatuses.has(data.status)){clearTimeout(timer);clearInterval(clock);unwatch?.();unwatch=null;unlisten();again=false;summary();return;}
  }catch(e){
   if(active!==current)return;unavailable=true;estimate=undefined;
   if(e.status===404){
    panel.dataset.pending='false';panel.querySelector('.dyws-pending-indicator').hidden=true;panel.querySelector('.dyws-tracking-driver').hidden=true;write('.dyws-driver-name','');write('.dyws-driver-vehicle','');
    for(const selector of ['.dyws-tracking-details','.dyws-tracking-timeline','.dyws-tracking-complete','.dyws-tracking-arrival'])panel.querySelector(selector).hidden=true;
    for(const selector of ['.dyws-tracking-receipt','.dyws-tracking-fulfillment-details','.dyws-tracking-help','.dyws-tracking-payment','.dyws-tracking-gps'])panel.querySelector(selector).replaceChildren();
    active=null;lastData=null;renderLocation?.clear?.();panel.querySelector('.dyws-tracking-map').replaceChildren();write('.dyws-tracking-status','Tracking unavailable');write('.dyws-tracking-message','This tracking link is unavailable or has expired.');write('.dyws-tracking-updated','');announce('expired','This tracking link is unavailable or has expired.');clearInterval(clock);unwatch?.();unwatch=null;unlisten();again=false;return;
   }
   if(lastData)summary();else{write('.dyws-tracking-status','Connecting to your order');write('.dyws-arrival-value','Reconnecting');write('.dyws-arrival-detail','We could not load your order yet. Retrying automatically.');announce('connecting','We could not load your order yet. Retrying automatically.');}
  }finally{polling=false;onReady();if(again){again=false;queueMicrotask(poll);}}
  if(!api.watch&&active===current)timer=setTimeout(poll,doc.hidden?30000:5000);
 }
 function destroy(){active=null;lastData=null;renderLocation?.clear?.();clearTimeout(timer);clearInterval(clock);unwatch?.();unwatch=null;unlisten();panel?.remove();panel=null;}
 function restore(){try{const saved=JSON.parse(sessionStorage.getItem(storageKey));if(saved?.id&&saved?.token)show(saved.id,saved.token);}catch{}}
 return {show,restore,destroy,scrollIntoView(){panel?.scrollIntoView({behavior:'smooth',block:'start'});}};
}
