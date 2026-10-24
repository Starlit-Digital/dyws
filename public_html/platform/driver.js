import {markReady} from '../dyws/diagnostics.js';
import {plugins} from './plugins.js?v=39';
import {mountDriver} from '../dyws/driver.js?v=39';
import {api} from './api.js';
import {loadRole,applyRoleLabels} from '../dyws/role-labels.js';
const role=await loadRole(api);
applyRoleLabels(document.body,role);
document.title=role.singular+' | dyws';
let testLocation=null;const token=sessionStorage.getItem('dyws-driver');if(token){try{testLocation=(await api('/driver/gps-config',{token})).testLocation;}catch{}}
mountDriver({api,plugins,onReady:()=>markReady(),onSignedOut:()=>location.replace(new URL('../driver/',import.meta.url)),root:document.body,testLocationName:testLocation?.name,simulatePosition:testLocation?()=>testLocation:undefined,renderLocation:plugins.createLocationRenderer({api,defaultCenter:{lat:53.61665,lng:-113.39804}})});
