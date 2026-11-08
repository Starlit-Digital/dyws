import {mountSettings} from './settings.js';
export function register(plugin){
 plugin.addFilter('admin:navigation',links=>[...links,['order-map','Order map',new URL('./page.php',import.meta.url).href]]);
 plugin.addAction('admin:settings',({root,api})=>{const host=root.querySelector('[data-dyws-plugin-settings]');if(host&&!host.querySelector('#plugin-openstreetmap'))mountSettings(host,api,{document:plugin.document});});
}
