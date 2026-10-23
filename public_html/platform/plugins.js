import {traceLoad} from '../dyws/diagnostics.js';
import {createPluginHost} from '../dyws/plugins.js?v=38';
import {api} from './api.js';
export const plugins=await traceLoad('Plugin startup',()=>createPluginHost({api}));
