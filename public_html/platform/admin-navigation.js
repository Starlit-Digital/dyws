import {plugins} from './plugins.js?v=31';
import {mountAdminNavigation} from '../dyws/admin-navigation.js?v=31';
import {defaultRole} from '../dyws/role-labels.js';
const pages=[['reports','Reports','manager.html'],['catalog','Catalog','catalog-admin.html'],['drivers','Drivers','drivers-admin.html'],['password','Password','password-admin.html'],['settings','Settings','settings-admin.html'],['plugins','Plugins','plugins-admin.html']];
let revision=0;
export async function mountNavigation(current,role=defaultRole){
 const request=++revision;
 const links=await plugins.applyFilters('admin:navigation',pages.map(page=>page[0]==='drivers'?['drivers',role.plural,page[2]]:[...page]),{current,role});
 if(request!==revision)return;
 const valid=Array.isArray(links)?links.filter(link=>{
  if(!Array.isArray(link)||link.length!==3||!link.every(x=>typeof x==='string'))return false;
  try{const url=new URL(link[2],location.href);return url.origin===location.origin&&['http:','https:'].includes(url.protocol);}catch{return false;}
 }):pages;
 mountAdminNavigation({current,pages:valid});
}
