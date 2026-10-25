export const pluginTypes=[['all','All plugins'],['payments','Payments'],['ordering','Ordering'],['location','Maps and location'],['reporting','Reporting'],['interface','Interface'],['system','System'],['other','Other']];
export function pluginType(plugin){return pluginTypes.some(([id])=>id===plugin.type)&&plugin.type!=='all'?plugin.type:'other';}
export function pluginsOfType(plugins,type){return type==='all'?plugins:plugins.filter(p=>pluginType(p)===type);}
