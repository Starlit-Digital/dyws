import {createLocationRenderer} from '../dyws/google-maps.js';
import {renderDinerLocation} from '../demo-map.js';
import {mountNavigation} from './admin-navigation.js';
import {mountCatalogEditor} from '../dyws/catalog-editor.js';
import {mountDriverAdmin,mountPasswordAdmin} from '../dyws/account-editor.js';
import {mountStripeAdmin} from '../dyws/stripe-editor.js';
import {api} from './api.js';
import {mountMapsSettings} from '../dyws/maps-settings.js';
import {mountGeneralSettings} from '../dyws/general-settings.js';
import {loadRole,applyRoleLabels} from '../dyws/role-labels.js';
const role=await loadRole(api);
applyRoleLabels(document.body,role);
if(document.body.dataset.adminPage==='drivers')document.title=role.plural+' | DYWS admin';
const current=document.body.dataset.adminPage;
mountNavigation(current,role);
const mounts={catalog:mountCatalogEditor,drivers:mountDriverAdmin,stripe:mountStripeAdmin,password:mountPasswordAdmin,settings:mountGeneralSettings};
await mounts[current]?.({root:document.body,api,role,createLocationRenderer:()=>createLocationRenderer({api,fallback:renderDinerLocation,defaultCenter:{lat:53.61665,lng:-113.39804}}),onSave:settings=>mountNavigation(current,settings.driverRole)});

if(current==='settings')await mountMapsSettings({root:document.body,api});
const operator=sessionStorage.getItem('starlit-go-manager');
if(operator){
 let previous;
 const routes={catalog:'/manager/catalog',drivers:'/manager/drivers',stripe:'/manager/stripe',settings:'/manager/settings'};
 if(routes[current]){try{previous=JSON.stringify(await api(routes[current],{token:operator}));}catch{}}
 api.watch({scope:'operator',token:operator,interval:15000},async event=>{
  if(event.type==='auth-error'&&[401,403].includes(event.status)){sessionStorage.removeItem('starlit-go-manager');document.querySelector('[data-admin-content]').hidden=true;document.querySelector('[data-admin-login]').hidden=false;return;}
  const settings=await api('/settings');mountNavigation(current,settings.driverRole);
  if(!routes[current])return;
  const data=await api(routes[current],{token:operator});const signature=JSON.stringify(data);
  if(previous!==undefined&&signature!==previous){let notice=document.querySelector('[data-dyws-update-notice]');if(!notice){notice=document.createElement('p');notice.dataset.dywsUpdateNotice='true';notice.className='dyws-update-notice';notice.setAttribute('role','status');document.querySelector('main').prepend(notice);}notice.textContent='Saved data changed. Reload this page when ready. Your current fields have been kept.';}
  previous=signature;
 });
}
