import {createTracking} from '../dyws/tracking.js';
import {api} from './api.js';
import {createLocationRenderer} from '../dyws/google-maps.js';
import {renderDinerLocation} from '../demo-map.js';
import {loadRole} from '../dyws/role-labels.js';
const role=await loadRole(api);
const tracking=createTracking({api,role,container:document.querySelector('main'),trackingPage:'tracking.html',renderLocation:createLocationRenderer({api,fallback:renderDinerLocation})});
export const showTracking=tracking.show;
if(document.body.dataset.trackingPage==='true'){
 let id,token;try{[id,token]=location.hash.slice(1).split('.').map(decodeURIComponent);}catch{}
 if(id&&token)tracking.show(id,token);else document.querySelector('main').insertAdjacentHTML('beforeend','<p>Use the private tracking link from your order confirmation.</p>');
}else tracking.restore();
