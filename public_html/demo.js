import {markReady} from './dyws/diagnostics.js';
import {plugins} from './platform/plugins.js?v=39';
import {mountStorefront} from './dyws/storefront.js?v=40';
import {api} from './platform/api.js';
import {loadRole,applyRoleLabels} from './dyws/role-labels.js';
const role=await loadRole(api);
applyRoleLabels(document.body,role);
mountStorefront({
 ordering:document.querySelector('dyws-ordering'),
 container:[...document.querySelectorAll('[data-dyws-rendered],#menu')],
 navigation:document.querySelector('nav[aria-label="Menu categories"]'),
 termsURL:new URL('./terms/',import.meta.url).href,
 loading:document.querySelector('#loading'),api,hydrate:true,plugins,
 onOrderComplete:receipt=>{if(receipt.trackingToken)location.assign(new URL('./tracking/',import.meta.url).href+'#'+encodeURIComponent(receipt.id)+'.'+encodeURIComponent(receipt.trackingToken));}
});

const ordering=document.querySelector('dyws-ordering');if(ordering.catalog)markReady();else ordering.addEventListener('ordering-ready',()=>markReady(),{once:true});
let publicState=JSON.stringify(await api('/catalog'));
api.watch({scope:'public',interval:15000},async()=>{
 const [catalog,settings]=await Promise.all([api('/catalog'),api('/settings')]);
 applyRoleLabels(document.body,settings.driverRole);
 const signature=JSON.stringify(catalog);
 if(publicState!==undefined&&publicState!==signature){let notice=document.querySelector('[data-dyws-catalog-notice]');if(!notice){notice=document.createElement('p');notice.dataset.dywsCatalogNotice='true';notice.className='dyws-update-notice';notice.textContent='The catalog has changed. Refresh the page to see the latest items and prices.';document.querySelector('main').prepend(notice);}}
 publicState=signature;
});
