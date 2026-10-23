import {mountNavigation} from './admin-navigation.js';
import {mountManager} from '../dyws/manager.js';
import {api} from './api.js';
mountNavigation('reports');
mountManager({api,root:document.body,onCatalog:catalog=>{document.title='Business admin | '+catalog.platformName;}});
