import {mountBooking} from './storefront.js';
for(const root of document.querySelectorAll('[data-dyws-booking]')){
 void mountBooking(root,{endpoint:root.dataset.dywsBookingEndpoint||'api/'});
}
