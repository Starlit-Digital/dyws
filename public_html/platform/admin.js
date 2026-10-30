import {mountAdminRefresh} from '../dyws/admin-refresh.js';
import {markReady} from '../dyws/diagnostics.js';
import {redirectToAuth} from '../dyws/admin-session.js?v=39';
import {plugins} from './plugins.js?v=39';
import {mountNavigation} from './admin-navigation.js?v=39';
import {api,bootstrap} from './api.js';
import {loadRole,applyRoleLabels} from '../dyws/role-labels.js';
const role=await loadRole(api);
applyRoleLabels(document.body,role);
if(document.body.dataset.adminPage==='drivers')document.title=role.plural+' | dyws';
const current=document.body.dataset.adminPage;
mountNavigation(current,role);
const loaders={catalog:()=>import('../dyws/catalog-editor.js?v=options-20261028'),drivers:()=>import('../dyws/account-editor.js?v=39'),password:()=>import('../dyws/account-editor.js?v=39'),settings:()=>import('../dyws/general-settings.js?v=benefits-20261028'),plugins:()=>import('../dyws/plugin-admin.js?v=39')};
const names={catalog:'mountCatalogEditor',drivers:'mountDriverAdmin',password:'mountPasswordAdmin',settings:'mountGeneralSettings',plugins:'mountPluginAdmin'};
const page=await loaders[current]?.();
await page?.[names[current]]?.({root:document.body,api,role,businessPlugins:bootstrap?.businessPlugins,createLocationRenderer:()=>plugins.createLocationRenderer({api,defaultCenter:{lat:53.61665,lng:-113.39804}}),onSave:settings=>mountNavigation(current,settings.driverRole)});

if(current==='settings'&&sessionStorage.getItem('dyws-manager'))await plugins.runAction('admin:settings',{root:document.body,api});
markReady();
if(plugins.errors.length)document.querySelector('[data-admin-error]').textContent=plugins.errors.join(' ');
const operator=sessionStorage.getItem('dyws-manager');
if(operator)mountAdminRefresh({root:document.body,api,token:operator,onUnauthorized:()=>redirectToAuth(),onRefresh:async()=>{
 const settings=await api('/settings');mountNavigation(current,settings.driverRole);
}});
