import {mountStorefront,createAPIClient} from './dyws/index.js';
import {renderDinerLocation} from './demo-map.js';
const api=createAPIClient(new URL('./api/index.php',import.meta.url));
import {loadRole,applyRoleLabels} from './dyws/role-labels.js';
const role=await loadRole(api);
applyRoleLabels(document.body,role);
mountStorefront({
 ordering:document.querySelector('dyws-ordering'),
 container:[...document.querySelectorAll('[data-dyws-rendered],#menu')],
 navigation:document.querySelector('nav[aria-label="Menu categories"]'),
 loading:document.querySelector('#loading'),api,hydrate:true,
 tracking:{role,container:document.querySelector('main'),trackingPage:'tracking.html',renderLocation:renderDinerLocation}
});
