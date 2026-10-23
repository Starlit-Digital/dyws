import {plugins} from './plugins.js?v=31';
import {mountNavigation} from './admin-navigation.js?v=31';
import {mountManager} from '../dyws/manager.js?v=31';
import {api} from './api.js';
import {loadRole} from '../dyws/role-labels.js';
const role=await loadRole(api);
mountNavigation('reports',role);
mountManager({api,role,plugins,renderLocation:plugins.createLocationRenderer({api}),root:document.body});
