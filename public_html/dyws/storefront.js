import './component.js?v=options-20261028';
import {mountCatalog} from './catalog.js?v=options-20261028';
import {createTracking} from './tracking.js?v=52';
export function mountStorefront({ordering,container,navigation,loading,api,tracking,submitOrder,onOrderComplete,hydrate=false,plugins,termsURL,accountURL}) {
 ordering.plugins=plugins;
 const previousAccountAPI=ordering.customerAPI,previousAccountURL=ordering.accountURL;
 ordering.accountURL=accountURL;ordering.customerAPI=accountURL?((route,options={})=>api(route,{...options,customer:true})):null;
 const previousPickupAPI=ordering.pickupAPI;ordering.pickupAPI=api;
 const previousGuestAPI=ordering.guestAPI,previousTermsURL=ordering.termsURL;
 ordering.termsURL=termsURL||ordering.getAttribute('terms-url');
 ordering.guestAPI=ordering.termsURL?((route,options={})=>api(route,{...options,guest:true})):null;
 const catalogs=(Array.isArray(container)?container:[container]).map((element,index)=>mountCatalog({ordering,container:element,navigation:index===0?navigation:null,loading:index===0?loading:null,hydrate,plugins}));
 const tracker=tracking?createTracking({api,plugins,...tracking}):null;
 const previousSubmit=ordering.submitOrder;
 ordering.submitOrder=submitOrder||(async order=>api('/orders',{method:'POST',guest:!!ordering.guestAPI,customer:true,body:{...order,demoAcknowledged:true}}));
 const complete=event=>{if(onOrderComplete){onOrderComplete(event.detail);return;}if(event.detail.trackingToken)tracker?.show(event.detail.id,event.detail.trackingToken);};
 const closed=()=>tracker?.scrollIntoView();
 ordering.addEventListener('order-complete',complete);ordering.addEventListener('order-confirmation-closed',closed);
 tracker?.restore();
 return {catalogs,tracking:tracker,destroy(){catalogs.forEach(c=>c.destroy());tracker?.destroy();ordering.removeEventListener('order-complete',complete);ordering.removeEventListener('order-confirmation-closed',closed);ordering.pickupAPI=previousPickupAPI;ordering.submitOrder=previousSubmit;ordering.guestAPI=previousGuestAPI;ordering.termsURL=previousTermsURL;ordering.customerAPI=previousAccountAPI;ordering.accountURL=previousAccountURL;}};
}
