import {mountSettings} from '../dyws/settings.js';
import {api} from './api.js';
await mountSettings({api,root:document.body});
