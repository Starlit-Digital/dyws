import {mountNavigation} from './admin-navigation.js';
import {mountCatalogEditor} from '../dyws/catalog-editor.js';
import {mountDriverAdmin,mountPasswordAdmin} from '../dyws/account-editor.js';
import {mountStripeAdmin} from '../dyws/stripe-editor.js';
import {api} from './api.js';
const current=document.body.dataset.adminPage;
mountNavigation(current);
const mounts={catalog:mountCatalogEditor,drivers:mountDriverAdmin,stripe:mountStripeAdmin,password:mountPasswordAdmin};
await mounts[current]?.({root:document.body,api});
