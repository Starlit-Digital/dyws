import {api} from '../platform/api.js';
import {mountNavigation} from '../platform/admin-navigation.js?v=39';
import {adminPage} from './admin-navigation.js?v=39';
import {createPluginHost} from './plugins.js?v=39';
import {markReady} from './diagnostics.js';
await mountNavigation('plugins');
const root=document.body,page=adminPage({root,api}),id=root.dataset.editPlugin,state=root.querySelector('[data-plugin-edit-state]'),activate=root.querySelector('[data-plugin-edit-activate]');
try{
 const summary=await page.request('/manager/plugins'),record=summary.plugins.find(p=>p.id===id);
 if(!record)throw new Error('Plugin not found.');
 if(!record.active){state.textContent='Activate this plugin to edit its settings. Saved settings are retained while inactive.';activate.hidden=record.locked||!!record.error;activate.onclick=()=>page.action(activate,async()=>{await page.request('/manager/plugins',{method:'POST',body:{id,active:true,revision:summary.revision}});location.reload();});}
 else{
  state.textContent=record.locked?'This plugin is required by the installation.':'Enabled';
  const scopedAPI=async(route,options)=>{const result=await api(route,options);return route==='/plugins'?{...result,plugins:result.plugins.filter(p=>p.id===id)}:result;};
  const host=await createPluginHost({api:scopedAPI});await host.runAction('admin:settings',{root,api});
  if(host.errors.length)throw new Error(host.errors.join(' '));
  if(!root.querySelector('[data-dyws-plugin-settings]').children.length)state.textContent+=' · This plugin has no additional settings.';
  window.addEventListener('pagehide',()=>host.destroy(),{once:true});
 }
}catch(error){page.error.textContent=error.message;}
markReady();
