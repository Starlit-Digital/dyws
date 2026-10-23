import {createPluginHost} from '../dyws/plugins.js?v=31';
import {api} from './api.js';
export const plugins=await createPluginHost({api});
