import {statusBadge} from '../../dyws/status-badge.js';
import {adminPage} from '../../dyws/admin-navigation.js?v=39';
export async function mountStripeAdmin({root=document,api,storageKey}) {
 const page=adminPage({root,api,storageKey});if(!page.token)return;
 const form=root.querySelector('#stripe-form');let refresh,latest;
 function display(data){latest=data;root.querySelector('#stripe-state').innerHTML=`<span class="dyws-status-row">${statusBadge(data.enabled?'enabled':'disabled',data.enabled?'Stripe sandbox':'Manual test orders')}${statusBadge(data.hasApiKey?'enabled':'unpaid',data.hasApiKey?'API key saved':'API key needed')}${statusBadge(data.hasWebhookSecret?'enabled':'unpaid',data.hasWebhookSecret?'Webhook saved':'Webhook needed')}</span>`;form.elements.enabled.checked=data.enabled;root.querySelector('#webhook-url').textContent=data.webhookUrl;refresh?.reset(data);}
 form.onsubmit=event=>{event.preventDefault();page.action(event.submitter,async()=>{const body={apiKey:form.elements.apiKey.value,webhookSecret:form.elements.webhookSecret.value,enabled:form.elements.enabled.checked};const data=await page.request('/manager/plugins/stripe/settings',{method:'POST',body});form.reset();display(data);root.querySelector('#stripe-message').textContent='Payment settings saved.';});};
 root.querySelector('#verify-stripe').onclick=event=>page.action(event.target,async()=>{await page.request('/manager/plugins/stripe/verify',{method:'POST',body:{}});root.querySelector('#stripe-message').textContent='Stripe accepted the sandbox key. Complete a sandbox checkout to verify payment and webhook permissions.';});
 try{display(await page.request('/manager/plugins/stripe/settings'));}catch(e){page.error.textContent=e.message;}
 refresh=page.autoRefresh({read:()=>page.request('/manager/plugins/stripe/settings'),apply:display,forms:[form],initial:latest});
}
