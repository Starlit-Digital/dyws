import {mountAdminNavigation} from '../dyws/admin-navigation.js?v=26';
import {defaultRole} from '../dyws/role-labels.js';
const pages=[['reports','Reports','manager.html'],['catalog','Catalog','catalog-admin.html'],['drivers','Drivers','drivers-admin.html'],['stripe','Stripe','stripe-admin.html'],['password','Password','password-admin.html'],['settings','Settings','settings-admin.html'],['plugins','Plugins','plugins-admin.html']];
export function mountNavigation(current,role=defaultRole){mountAdminNavigation({current,pages:pages.map(page=>page[0]==='drivers'?['drivers',role.plural,page[2]]:page)});}
