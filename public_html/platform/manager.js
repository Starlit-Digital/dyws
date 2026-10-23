import {createLocationRenderer} from '../dyws/google-maps.js';
import {renderDinerLocation} from '../demo-map.js';
import {mountNavigation} from './admin-navigation.js';
import {mountManager} from '../dyws/manager.js';
import {api} from './api.js';
import {loadRole} from '../dyws/role-labels.js';
const role=await loadRole(api);
mountNavigation('reports',role);
mountManager({api,role,renderLocation:createLocationRenderer({api,fallback:renderDinerLocation}),root:document.body,onCatalog:catalog=>{document.title='Business admin | '+catalog.platformName;}});
