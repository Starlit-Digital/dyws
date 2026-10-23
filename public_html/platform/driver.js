import {mountDriver} from '../dyws/driver.js';
import {api} from './api.js';
import {simulateDinerPosition} from '../demo-map.js';
import {loadRole,applyRoleLabels} from '../dyws/role-labels.js';
const role=await loadRole(api);
applyRoleLabels(document.body,role);
document.title=role.singular+' demo | Starlit Go';
mountDriver({api,root:document.body,simulatePosition:simulateDinerPosition});
