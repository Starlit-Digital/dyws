import {mountNavigation} from './admin-navigation.js';
import {mountManager} from '../dyws/manager.js';
import {api} from './api.js';
import {loadRole} from '../dyws/role-labels.js';
const role=await loadRole(api);
mountNavigation('reports',role);
mountManager({api,role,root:document.body,onCatalog:catalog=>{document.title='Business admin | '+catalog.platformName;}});
