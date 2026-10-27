import {createTracking} from '../dyws/tracking.js?v=52';
import {api,bootstrap} from './api.js';
import {markReady} from '../dyws/diagnostics.js';
import {plugins} from './plugins.js?v=39';
import {loadRole} from '../dyws/role-labels.js';
const role=await loadRole(api);
const tracking=createTracking({api,role,onReady:()=>markReady(),plugins,renderPayment:plugins.renderPayment,container:document.querySelector('main'),shopPage:document.body.dataset.trackingPage==='true'?new URL('../',import.meta.url).href:undefined,trackingPage:document.body.dataset.trackingPage==='true'?undefined:new URL('../tracking/',import.meta.url).href,renderLocation:plugins.createLocationRenderer({api})});
export const showTracking=tracking.show;
if(document.body.dataset.trackingPage==='true'){
 const {id,token}=bootstrap?.tracking||{};
 if(id&&token)tracking.show(id,token);else document.querySelector('main').insertAdjacentHTML('beforeend','<p>Use the private tracking link from your order confirmation.</p>');
}else tracking.restore();
