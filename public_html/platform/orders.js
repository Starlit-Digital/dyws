import {plugins} from './plugins.js?v=35';
import {mountNavigation} from './admin-navigation.js?v=35';
import {mountOrders} from '../dyws/orders.js?v=35';
import {api} from './api.js';
import {loadRole} from '../dyws/role-labels.js';
const role=await loadRole(api);
mountNavigation('orders',role);
mountOrders({api,role,plugins,renderLocation:plugins.createLocationRenderer({api}),root:document.body});
