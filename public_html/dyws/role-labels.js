export const defaultRole=Object.freeze({singular:'Driver',plural:'Drivers'});
export async function loadRole(api){
 try{return (await api('/settings')).driverRole||defaultRole;}
 catch{return defaultRole;}
}
// Replace only explicitly marked text nodes, never input values or HTML.
export function applyRoleLabels(root,role=defaultRole){
 root.querySelectorAll('[data-dyws-role-text]').forEach(node=>{
  node.textContent=node.dataset.dywsRoleText.replace(/\{(role|roles)\}/g,(_,key)=>key==='role'?role.singular:role.plural);
 });
}
