import {mountStripeAdmin} from './settings.js';
import {renderStripePayment} from './payment.js';
export function register(plugin){
 plugin.provide('payment.renderer.stripe',renderStripePayment);
 plugin.addAction('admin:settings',async({root,api})=>{
  const container=root.querySelector('[data-dyws-plugin-settings]');if(!container)return;
  if(!container.querySelector('#stripe-form')){
  const response=await fetch(new URL('./settings.php',import.meta.url));if(!response.ok)throw new Error('Stripe settings unavailable.');
  container.insertAdjacentHTML('beforeend',await response.text());
  }
  await mountStripeAdmin({root,api});
  if(location.hash==='#plugin-stripe')container.querySelector('#plugin-stripe')?.scrollIntoView({block:'start'});
 });
}
