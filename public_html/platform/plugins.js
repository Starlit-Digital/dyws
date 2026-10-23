import {createPluginHost} from '../dyws/plugins.js?v=36';
import {api} from './api.js';
export const plugins=await createPluginHost({api});
