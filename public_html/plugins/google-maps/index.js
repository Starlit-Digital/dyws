import {createLocationRenderer} from './maps.js';
import {mountMapsSettings} from './settings.js';
export function register(plugin){
 plugin.provide('location.renderer',options=>createLocationRenderer({...options,fallback:options.fallback||((point,role)=>{
  const link=plugin.document.createElement('a');link.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(point.latitude+','+point.longitude);link.textContent='Open '+role.singular.toLowerCase()+' location in Google Maps';link.target='_blank';link.rel='noopener noreferrer';return link;
 })}));
 plugin.addAction('admin:settings',async({root,api})=>{
  const container=root.querySelector('[data-dyws-plugin-settings]');if(!container)return;
  const response=await fetch(new URL('./settings.php',import.meta.url));if(!response.ok)throw new Error('Plugin settings unavailable.');
  container.insertAdjacentHTML('beforeend',await response.text());
  const origin=container.querySelector('[data-dyws-site-origin]');if(origin)origin.textContent=location.origin+'/*';
  await mountMapsSettings({root,api});
 });
}
