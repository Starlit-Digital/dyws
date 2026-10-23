import {adminPage} from '../../dyws/admin-navigation.js?v=31';
export async function mountStripeAdmin({root=document,api,storageKey}) {
 const page=adminPage({root,api,storageKey});if(!page.token)return;
 const form=root.querySelector('#stripe-form');
 function display(data){root.querySelector('#stripe-state').textContent=`${data.enabled?'Stripe test checkout enabled':'Manual test orders enabled'}. API key ${data.hasApiKey?'saved':'not set'}. Webhook secret ${data.hasWebhookSecret?'saved':'not set'}.`;form.elements.enabled.checked=data.enabled;root.querySelector('#webhook-url').textContent=data.webhookUrl;}
 form.onsubmit=event=>{event.preventDefault();page.action(event.submitter,async()=>{const body={apiKey:form.elements.apiKey.value,webhookSecret:form.elements.webhookSecret.value,enabled:form.elements.enabled.checked};const data=await page.request('/manager/plugins/stripe/settings',{method:'POST',body});form.reset();display(data);root.querySelector('#stripe-message').textContent='Payment settings saved.';});};
 root.querySelector('#verify-stripe').onclick=event=>page.action(event.target,async()=>{await page.request('/manager/plugins/stripe/verify',{method:'POST',body:{}});root.querySelector('#stripe-message').textContent='Stripe accepted the sandbox key. Complete a sandbox checkout to verify payment and webhook permissions.';});
 try{display(await page.request('/manager/plugins/stripe/settings'));}catch(e){page.error.textContent=e.message;}
}
