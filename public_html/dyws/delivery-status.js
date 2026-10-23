/** Customer language and estimates, without inventing preparation or travel times. */
export const terminalStatuses=new Set(['delivered','completed','cancelled']);
export function deliveryStatus(order,{estimate=undefined,now=Date.now(),role='Driver',unavailable=false}={}) {
 const pickup=order.fulfillment==='pickup',status=order.status;
 const terminal=terminalStatuses.has(status),complete=['delivered','completed'].includes(status);
 const titles={placed:'Order received',accepted:'Order accepted',preparing:'Preparing your order',ready:pickup?'Ready for pickup':'Ready for delivery',out_for_delivery:role+' is on the way',delivered:'Delivered',completed:'Collected',cancelled:'Order cancelled'};
 const messages={placed:'Waiting for the business to accept your order.',accepted:'Your order is next for preparation.',preparing:'Your order is being prepared.',ready:pickup?'Your order is ready to collect.':'Your order is ready. Waiting for pickup by your '+role.toLowerCase()+'.',out_for_delivery:'Follow your delivery here. Updates appear automatically.',delivered:'Thank you for your order.',completed:'Thank you for your order.',cancelled:'This order has been cancelled.'};
 const stages=pickup?['placed','preparing','ready','completed']:['placed','preparing','ready','out_for_delivery','delivered'];
 const current=stages.indexOf(status==='accepted'?'placed':status);
 const stamp=order.events?.filter(e=>e.status===status).at(-1)?.created_at||order.updatedAt;
 const view={title:titles[status]||'Order update',message:messages[status]||'',terminal,complete,stamp,stages:stages.map((key,index)=>({key,label:({placed:'Received',preparing:'Preparing',ready:'Ready',out_for_delivery:'On the way',delivered:'Delivered',completed:'Collected'})[key],state:index<current?'done':index===current?'current':'upcoming'})),etaTitle:pickup?'Pickup':'Estimated arrival',etaValue:pickup?'Waiting for preparation':'Available after departure',etaDetail:pickup?'We will let you know here when your order is ready.':'An arrival estimate appears when your '+role.toLowerCase()+' starts the delivery.'};
 if(terminal){view.etaTitle='';view.etaValue='';view.etaDetail='';return view;}
 if(order.paymentProvider==='stripe'&&order.paymentStatus==='unpaid'&&status==='placed'){view.message='Complete your test payment below to continue.';view.etaValue='Waiting for payment';return view;}
 if(pickup){if(status==='ready')view.etaValue='Ready now';return view;}
 if(status!=='out_for_delivery')return view;
 const point=order.location,stale=order.gpsStale||!point||now-point.recorded_at*1000>60000;
 if(unavailable){view.etaValue='Reconnecting';view.etaDetail='The last order update is shown. Trying again automatically.';return view;}
 if(stale){view.etaValue=point?'Location update delayed':'Waiting for location';view.etaDetail='Your delivery is on the way. The estimate will return with a fresh location.';return view;}
 if(estimate===null){view.etaValue='Arrival estimate unavailable';view.etaDetail='Your delivery is still on the way. Follow the latest location below.';return view;}
 if(!estimate||!Number.isFinite(estimate.durationMillis)||estimate.durationMillis<0||!Number.isFinite(estimate.calculatedAt)||now-estimate.calculatedAt>120000){view.etaValue='Calculating arrival';view.etaDetail='An estimate will appear when the driving route is available.';return view;}
 const minutes=Math.max(1,Math.ceil(estimate.durationMillis/60000));
 view.etaTitle=order.locationSource==='simulated'?'Demo arrival estimate':'Estimated arrival';
 view.etaValue=minutes<=2?'Arriving soon':'About '+minutes+' min';
 const time=new Date(estimate.calculatedAt+estimate.durationMillis).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
 view.etaDetail=(order.locationSource==='simulated'?'Simulated location. ':'')+'Around '+time+'. Based on the driving route and traffic. Timing may change.';
 return view;
}
