import '../dyws/customer-preferences.js';
import {createAPIClient} from '../dyws/api.js';
import {mountCustomerNavigation} from '../dyws/customer-navigation.js?v=benefits-20261028';
mountCustomerNavigation({root:document,api:createAPIClient(new URL('../api/',import.meta.url).href)});
