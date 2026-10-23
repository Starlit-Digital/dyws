import {createTracking} from '../dyws/tracking.js?v=31';
import {api} from './api.js';
import {plugins} from './plugins.js?v=31';
import {loadRole} from '../dyws/role-labels.js';
const role=await loadRole(api);
const tracking=createTracking({api,role,plugins,renderPayment:plugins.renderPayment,container:document.querySelector('main'),shopPage:document.body.dataset.trackingPage==='true'?'./':undefined,trackingPage:document.body.dataset.trackingPage==='true'?undefined:'tracking.html',renderLocation:plugins.createLocationRenderer({api})});
export const showTracking=tracking.show;
if(document.body.dataset.trackingPage==='true'){
 let id,token;try{[id,token]=location.hash.slice(1).split('.').map(decodeURIComponent);}catch{}
 if(id&&token)tracking.show(id,token);else document.querySelector('main').insertAdjacentHTML('beforeend','<p>Use the private tracking link from your order confirmation.</p>');
}else tracking.restore();
