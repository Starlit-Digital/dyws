import {plugins} from './plugins.js?v=39';
import {mountNavigation} from './admin-navigation.js?v=39';
import {mountOrders} from '../dyws/orders.js?v=benefits-20261028';
import {api} from './api.js';
import {loadRole} from '../dyws/role-labels.js';
const role=await loadRole(api);
mountNavigation('orders',role);
mountOrders({api,role,plugins,renderLocation:plugins.createLocationRenderer({api}),root:document.body});
