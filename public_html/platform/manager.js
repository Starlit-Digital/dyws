import {plugins} from './plugins.js?v=35';
import {mountNavigation} from './admin-navigation.js?v=35';
import {mountManager} from '../dyws/manager.js?v=35';
import {api} from './api.js';
import {loadRole} from '../dyws/role-labels.js';
const role=await loadRole(api);
mountNavigation('reports',role);
mountManager({api,role,plugins,loginPage:new URL('../orders/',import.meta.url).href,root:document.body});
