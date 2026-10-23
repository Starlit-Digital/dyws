import {plugins} from './plugins.js';
import {mountDriver} from '../dyws/driver.js';
import {api} from './api.js';
import {loadRole,applyRoleLabels} from '../dyws/role-labels.js';
const role=await loadRole(api);
applyRoleLabels(document.body,role);
document.title=role.singular+' demo | dyws';
let testLocation=null;const token=sessionStorage.getItem('starlit-go-driver');if(token){try{testLocation=(await api('/driver/gps-config',{token})).testLocation;}catch{}}
mountDriver({api,root:document.body,testLocationName:testLocation?.name,simulatePosition:testLocation?()=>testLocation:undefined,renderLocation:plugins.createLocationRenderer({api,defaultCenter:{lat:53.61665,lng:-113.39804}})});
