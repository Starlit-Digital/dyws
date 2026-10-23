import {createPluginHost} from '../dyws/plugins.js?v=35';
import {api} from './api.js';
export const plugins=await createPluginHost({api});
