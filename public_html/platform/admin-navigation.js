import {mountAdminNavigation} from '../dyws/admin-navigation.js';
const pages=[['reports','Reports','manager.html'],['catalog','Catalog','catalog-admin.html'],['drivers','Drivers','drivers-admin.html'],['stripe','Stripe','stripe-admin.html'],['password','Password','password-admin.html']];
export function mountNavigation(current){mountAdminNavigation({current,pages});}
