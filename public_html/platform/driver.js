import {mountDriver} from '../dyws/driver.js';
import {api} from './api.js';
import {simulateDinerPosition} from '../demo-map.js';
mountDriver({api,root:document.body,simulatePosition:simulateDinerPosition});
