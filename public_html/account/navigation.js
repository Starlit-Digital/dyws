import '../dyws/customer-preferences.js';
import {createAPIClient} from '../dyws/api.js';
import {mountCustomerNavigation} from '../dyws/customer-navigation.js';
mountCustomerNavigation({root:document,api:createAPIClient(new URL('../api/',import.meta.url).href)});
