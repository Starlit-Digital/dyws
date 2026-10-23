import {plugins} from './plugins.js';
import {mountNavigation} from './admin-navigation.js?v=26';
import {mountCatalogEditor} from '../dyws/catalog-editor.js?v=26';
import {mountDriverAdmin,mountPasswordAdmin} from '../dyws/account-editor.js?v=26';
import {mountStripeAdmin} from '../dyws/stripe-editor.js?v=26';
import {api} from './api.js';
import {mountPluginAdmin} from '../dyws/plugin-admin.js';
import {mountGeneralSettings} from '../dyws/general-settings.js?v=26';
import {loadRole,applyRoleLabels} from '../dyws/role-labels.js';
const role=await loadRole(api);
applyRoleLabels(document.body,role);
if(document.body.dataset.adminPage==='drivers')document.title=role.plural+' | dyws';
const current=document.body.dataset.adminPage;
mountNavigation(current,role);
const mounts={catalog:mountCatalogEditor,drivers:mountDriverAdmin,stripe:mountStripeAdmin,password:mountPasswordAdmin,settings:mountGeneralSettings,plugins:mountPluginAdmin};
await mounts[current]?.({root:document.body,api,role,createLocationRenderer:()=>plugins.createLocationRenderer({api,defaultCenter:{lat:53.61665,lng:-113.39804}}),onSave:settings=>mountNavigation(current,settings.driverRole)});

if(current==='settings'&&sessionStorage.getItem('starlit-go-manager'))await plugins.runAction('admin:settings',{root:document.body,api});
if(plugins.errors.length)document.querySelector('[data-admin-error]').textContent=plugins.errors.join(' ');
const operator=sessionStorage.getItem('starlit-go-manager');
if(operator){
 let previous;
 const routes={catalog:'/manager/catalog',drivers:'/manager/drivers',stripe:'/manager/stripe',settings:'/manager/settings',plugins:'/manager/plugins'};
 if(routes[current]){try{previous=JSON.stringify(await api(routes[current],{token:operator}));}catch{}}
 api.watch({scope:'operator',token:operator,interval:15000},async event=>{
  if(event.type==='auth-error'&&[401,403].includes(event.status)){sessionStorage.removeItem('starlit-go-manager');document.querySelector('[data-admin-content]').hidden=true;document.querySelector('[data-admin-login]').hidden=false;document.querySelector('[data-admin-logout]').hidden=true;return;}
  const settings=await api('/settings');mountNavigation(current,settings.driverRole);
  if(!routes[current])return;
  const data=await api(routes[current],{token:operator});const signature=JSON.stringify(data);
  if(previous!==undefined&&signature!==previous){let notice=document.querySelector('[data-dyws-update-notice]');if(!notice){notice=document.createElement('p');notice.dataset.dywsUpdateNotice='true';notice.className='dyws-update-notice';notice.setAttribute('role','status');document.querySelector('main').prepend(notice);}notice.textContent='Updates available. Reload when ready.';}
  previous=signature;
 });
}
