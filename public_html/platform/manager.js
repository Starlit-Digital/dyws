import {mountManager} from '../dyws/manager.js';
import {api} from './api.js';
mountManager({api,root:document.body,onCatalog:catalog=>{document.title='Business admin | '+catalog.platformName;}});
