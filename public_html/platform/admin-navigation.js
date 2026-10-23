import {plugins} from './plugins.js?v=38';
import {mountAdminNavigation} from '../dyws/admin-navigation.js?v=38';
import {defaultRole} from '../dyws/role-labels.js';
const pages=[['orders','Orders',new URL('../orders/',import.meta.url).href],['reports','Reports',new URL('../reports/',import.meta.url).href],['catalog','Catalog',new URL('../catalog/',import.meta.url).href],['drivers','Drivers',new URL('../drivers/',import.meta.url).href],['password','Password',new URL('../password/',import.meta.url).href],['settings','Settings',new URL('../settings/',import.meta.url).href],['plugins','Plugins',new URL('../plugins/',import.meta.url).href]];
let revision=0;
export async function mountNavigation(current,role=defaultRole){
 const request=++revision;
 const links=await plugins.applyFilters('admin:navigation',pages.map(page=>page[0]==='drivers'?['drivers',role.plural,page[2]]:[...page]),{current,role});
 if(request!==revision)return;
 const valid=Array.isArray(links)?links.filter(link=>{
  if(!Array.isArray(link)||link.length!==3||!link.every(x=>typeof x==='string'))return false;
  try{const url=new URL(link[2],location.href);return url.origin===location.origin&&['http:','https:'].includes(url.protocol);}catch{return false;}
 }):pages;
 if(new URL(location.href).searchParams.get('diagnostics')==='1')for(const page of valid){const url=new URL(page[2]);url.searchParams.set('diagnostics','1');page[2]=url.href;}
 mountAdminNavigation({current,pages:valid});
}
