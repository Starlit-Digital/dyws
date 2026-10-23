import {createLocationRenderer} from '../dyws/google-maps.js';
import {renderDinerLocation} from '../demo-map.js';
import {mountNavigation} from './admin-navigation.js?v=26';
import {mountManager} from '../dyws/manager.js?v=26';
import {api} from './api.js?v=26';
import {loadRole} from '../dyws/role-labels.js';
const role=await loadRole(api);
mountNavigation('reports',role);
mountManager({api,role,renderLocation:createLocationRenderer({api,fallback:renderDinerLocation}),root:document.body});
