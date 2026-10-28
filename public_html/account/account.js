import {createAPIClient} from '../dyws/api.js';
import {mountCustomerAccount} from '../dyws/customer-account.js';
const api=createAPIClient(new URL('../api/',import.meta.url).href);
function takeToken(){
 const token=new URLSearchParams(location.hash.slice(1)).get('login');
 // The email capability never goes to a server URL, history, analytics or browser storage.
 if(location.hash)history.replaceState(null,'',location.pathname);
 return token;
}
const account=mountCustomerAccount({root:document.querySelector('[data-account-root]'),message:document.querySelector('[data-account-message]'),error:document.querySelector('[data-account-error]'),api,loginToken:takeToken(),demoLocked:document.body.dataset.demoLocked==='true',storeName:document.body.dataset.storeName,view:document.body.dataset.accountView,ordersURL:new URL('./orders/',import.meta.url).href});
window.addEventListener('hashchange',()=>{const token=takeToken();if(token)void account.openLink(token);});
window.addEventListener('pagehide',()=>{document.body.hidden=true;});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();else document.body.hidden=false;});
