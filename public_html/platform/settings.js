import {api} from './api.js';
const token=sessionStorage.getItem('starlit-go-manager');
const error=document.querySelector('#settings-error');
let revision;
async function catalog(){const data=await api('/manager/catalog',{token});revision=data.revision;document.querySelector('#catalog-json').value=JSON.stringify(data.catalog,null,2);}
function paymentState(data){document.querySelector('#stripe-state').textContent=`${data.enabled?'Stripe test checkout enabled':'Manual test orders enabled'}. API key ${data.hasApiKey?'saved':'not set'}. Webhook secret ${data.hasWebhookSecret?'saved':'not set'}.`;document.querySelector('#stripe-form').elements.enabled.checked=data.enabled;document.querySelector('#webhook-url').textContent=data.webhookUrl;}
async function action(button,fn){button.disabled=true;error.textContent='';try{await fn();}catch(e){error.textContent=e.message;}finally{button.disabled=false;}}
document.querySelector('#catalog-form').onsubmit=e=>{e.preventDefault();action(e.submitter,async()=>{const data=await api('/manager/catalog',{method:'POST',token,body:{catalog:JSON.parse(document.querySelector('#catalog-json').value),revision}});revision=data.revision;document.querySelector('#catalog-json').value=JSON.stringify(data.catalog,null,2);document.querySelector('#catalog-message').textContent='Catalog saved. New storefront visits and orders use these products and prices.';});};
document.querySelector('#reload-catalog').onclick=e=>action(e.target,catalog);
document.querySelector('#stripe-form').onsubmit=e=>{e.preventDefault();action(e.submitter,async()=>{const form=e.target;const body={apiKey:form.elements.apiKey.value,webhookSecret:form.elements.webhookSecret.value,enabled:form.elements.enabled.checked};const data=await api('/manager/stripe',{method:'POST',token,body});form.reset();paymentState(data);document.querySelector('#stripe-message').textContent='Payment settings saved. Existing orders keep their original payment method.';});};
document.querySelector('#verify-stripe').onclick=e=>action(e.target,async()=>{await api('/manager/stripe/verify',{method:'POST',token,body:{}});document.querySelector('#stripe-message').textContent='Stripe accepted the saved sandbox key. Complete a sandbox checkout to verify payment and webhook permissions.';});
if(!token)document.querySelector('#settings-login').hidden=false;
else{document.querySelector('#settings-content').hidden=false;try{await Promise.all([catalog(),api('/manager/stripe',{token}).then(paymentState)]);}catch(e){error.textContent=e.message;}}
