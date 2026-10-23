import {plugins} from './plugins.js?v=36';
import {mountNavigation} from './admin-navigation.js?v=36';
import {mountManager} from '../dyws/manager.js?v=36';
import {api} from './api.js';
import {loadRole} from '../dyws/role-labels.js';
const role=await loadRole(api);
mountNavigation('reports',role);
mountManager({api,role,plugins,root:document.body});
