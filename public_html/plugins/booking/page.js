import {offerDemoKiosk} from '../../dyws/demo-kiosk-link.js';
import {mountBooking} from './storefront.js?v=receipt-tab';
for(const root of document.querySelectorAll('[data-dyws-booking]')){
 const section=root.closest('section');
 if(section) void offerDemoKiosk(section,{booking:true});
 void mountBooking(root,{endpoint:root.dataset.dywsBookingEndpoint||'api/'});
}
