export async function register(plugin){
 const editor=new URL('./editor.php',import.meta.url).href;
 plugin.addFilter('admin:navigation',links=>[...links,['order-forms','Order forms',editor]]);
 plugin.addAction('admin:settings',({root})=>{
  const host=root.querySelector('[data-dyws-plugin-settings]');if(!host||host.querySelector('#plugin-order-format'))return;
  const section=plugin.document.createElement('section');section.id='plugin-order-format';
  const title=plugin.document.createElement('h2');title.textContent='Order Format';const link=plugin.document.createElement('a');link.href=editor;link.className='dyws-link-button';link.textContent='Open order forms editor';section.append(title,link);host.append(section);
 });
 let layouts={};
 if(plugin.document.querySelector('dyws-ordering'))try{layouts=(await plugin.api('/plugins/order-format/layouts')).layouts||{};}catch{}
 plugin.provide('order.layout',stage=>layouts[stage]||null);
}
