/** Only PHP authenticated pages contain this metadata. The API still requires bearer authorization. */
export function initializeAdminSession(root=document) {
 const token=root.querySelector('meta[name="dyws-admin-token"]')?.content;
 if(token)sessionStorage.setItem('dyws-manager',token);
}
export function redirectToAuth(root=document) {
 sessionStorage.removeItem('dyws-manager');
 const doc=root.ownerDocument||root;
 if(doc.body)doc.body.hidden=true;
 location.replace(doc.querySelector('meta[name="dyws-auth-url"]')?.content||new URL('../auth/',import.meta.url).href);
}
