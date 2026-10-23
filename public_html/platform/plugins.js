import {traceLoad} from '../dyws/diagnostics.js';
import {createPluginHost} from '../dyws/plugins.js?v=39';
import {api} from './api.js';
export const plugins=await traceLoad('Plugin startup',()=>createPluginHost({api}));
