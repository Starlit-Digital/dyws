import './component.js?v=38';
import {mountCatalog} from './catalog.js?v=38';
import {createTracking} from './tracking.js?v=38';
export function mountStorefront({ordering,container,navigation,loading,api,tracking,submitOrder,onOrderComplete,hydrate=false,plugins}) {
 ordering.plugins=plugins;
 const catalogs=(Array.isArray(container)?container:[container]).map((element,index)=>mountCatalog({ordering,container:element,navigation:index===0?navigation:null,loading:index===0?loading:null,hydrate,plugins}));
 const tracker=tracking?createTracking({api,plugins,...tracking}):null;
 const previousSubmit=ordering.submitOrder;
 ordering.submitOrder=submitOrder||(async order=>api('/orders',{method:'POST',body:{...order,demoAcknowledged:true}}));
 const complete=event=>{if(onOrderComplete){onOrderComplete(event.detail);return;}if(event.detail.trackingToken)tracker?.show(event.detail.id,event.detail.trackingToken);};
 const closed=()=>tracker?.scrollIntoView();
 ordering.addEventListener('order-complete',complete);ordering.addEventListener('order-confirmation-closed',closed);
 tracker?.restore();
 return {catalogs,tracking:tracker,destroy(){catalogs.forEach(c=>c.destroy());tracker?.destroy();ordering.removeEventListener('order-complete',complete);ordering.removeEventListener('order-confirmation-closed',closed);ordering.submitOrder=previousSubmit;}};
}
