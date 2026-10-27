import {formatTime} from './date-time.js';
/** Customer language and estimates, without inventing preparation or travel times. */
export const terminalStatuses=new Set(['delivered','completed','cancelled']);
export function deliveryStatus(order,{estimate=undefined,now=Date.now(),role='Driver',unavailable=false}={}) {
 const pickup=order.fulfillment==='pickup',status=order.status;
 const terminal=terminalStatuses.has(status),complete=['delivered','completed'].includes(status);
 const titles={placed:'Order received',accepted:'Order accepted',preparing:'Preparing your order',ready:pickup?'Ready for pickup':'Ready for delivery',out_for_delivery:role+' is on the way',delivered:'Delivered',completed:'Collected',cancelled:'Order cancelled'};
 const messages={placed:'Waiting for the business to accept your order.',accepted:'Your order is next for preparation.',preparing:'Your order is being prepared.',ready:pickup?'Your order is ready to collect.':'Your order is ready. Waiting for pickup by your '+role.toLowerCase()+'.',out_for_delivery:'Follow your delivery here. Updates appear automatically.',delivered:'Thank you for your order.',completed:'Thank you for your order.',cancelled:'This order has been cancelled.'};
 const stages=pickup?['placed','accepted','preparing','ready','completed']:['placed','accepted','preparing','ready','out_for_delivery','delivered'];
 const current=stages.indexOf(status);
 const stamp=order.events?.filter(e=>e.status===status).at(-1)?.created_at||order.updatedAt;
 const view={title:titles[status]||'Order update',message:messages[status]||'',terminal,complete,stamp,pending:false,stages:stages.map((key,index)=>({key,label:({placed:'Received',accepted:'Confirmed',preparing:'Preparing',ready:'Ready',out_for_delivery:'On the way',delivered:'Delivered',completed:'Collected'})[key],state:index<current?'done':index===current?'current':'upcoming'})),etaTitle:pickup?'Pickup':'Estimated arrival',etaValue:pickup?'Waiting for preparation':'Available after departure',etaDetail:pickup?'We will let you know here when your order is ready.':'An arrival estimate appears when your '+role.toLowerCase()+' starts the delivery.'};
 if(terminal){view.etaTitle='';view.etaValue='';view.etaDetail='';return view;}
 if(unavailable){view.etaTitle='Order updates';view.etaValue='Reconnecting';view.etaDetail='The last order update is shown. Trying again automatically.';return view;}
 if(order.paymentProvider&&order.paymentProvider!=='demo'&&order.paymentStatus==='unpaid'&&status==='placed'){view.message='Complete your payment below to continue.';view.etaTitle='Payment needed';view.etaValue='Waiting for payment';view.etaDetail='Use the payment options below. Confirmation will appear here after payment is verified.';return view;}
 if(status==='placed'){view.pending=true;view.etaTitle='Order confirmation';view.etaValue='Waiting for acceptance';view.etaDetail='Your order has been sent. This page will update as soon as the business accepts it. There is no need to order again.';return view;}
 if(pickup&&order.fulfillmentMeta?.scheduled){const meta=order.fulfillmentMeta;view.etaTitle='Scheduled pickup';view.etaValue=status==='ready'?'Ready to collect':meta.localTime;view.etaDetail='Pickup on '+meta.localDate+' at '+meta.localTime+' ('+meta.timeZone+').';if(status==='accepted')view.message='The business has confirmed your scheduled pickup.';return view;}
 if(status==='accepted'){view.etaTitle='Up next';view.etaValue='Preparation';view.etaDetail='The business has confirmed your order. We will show you when preparation begins.';return view;}
 if(pickup){if(status==='ready')view.etaValue='Ready now';return view;}
 if(status!=='out_for_delivery')return view;
 const point=order.location,stale=order.gpsStale||!point||now-point.recorded_at*1000>60000;
 if(order.deliveryRun?.stopsAhead>0){const n=order.deliveryRun.stopsAhead;view.etaTitle='Delivery progress';view.etaValue=n+' stop'+(n===1?'':'s')+' before yours';view.etaDetail='Your '+role.toLowerCase()+' is making earlier deliveries. An arrival estimate appears when your stop is next.';return view;}
 if(stale){view.etaValue=point?'Location update delayed':'Waiting for location';view.etaDetail='Your delivery is on the way. The estimate will return with a fresh location.';return view;}
 if(estimate===null){view.etaValue='Arrival estimate unavailable';view.etaDetail='Your delivery is still on the way. Follow the latest location below.';return view;}
 if(!estimate||!Number.isFinite(estimate.durationMillis)||estimate.durationMillis<0||!Number.isFinite(estimate.calculatedAt)||now-estimate.calculatedAt>120000){view.etaValue='Calculating arrival';view.etaDetail='An estimate will appear when the driving route is available.';return view;}
 const minutes=Math.max(1,Math.ceil(estimate.durationMillis/60000));
 view.etaTitle=order.locationSource==='simulated'?'Estimated arrival':'Estimated arrival';
 view.etaValue=minutes<=2?'Arriving soon':'About '+minutes+' min';
 const time=formatTime((estimate.calculatedAt+estimate.durationMillis)/1000);
 view.etaDetail=(order.locationSource==='simulated'?'Simulated location. ':'')+'Around '+time+'. Based on the driving route and traffic. Timing may change.';
 return view;
}
