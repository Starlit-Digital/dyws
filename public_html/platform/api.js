// Website endpoint configuration and compatibility exports.
import {createAPIClient} from '../dyws/api.js';
export {money,escapeHTML,statusText} from '../dyws/api.js';
export const endpoint=new URL('../api/index.php',import.meta.url);
export const api=createAPIClient(endpoint);
