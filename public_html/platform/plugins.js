import {createPluginHost} from '../dyws/plugins.js';
import {api} from './api.js';
export const plugins=await createPluginHost({api});
