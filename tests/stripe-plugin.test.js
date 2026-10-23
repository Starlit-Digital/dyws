import test from 'node:test';
import assert from 'node:assert/strict';
import {renderStripePayment} from '../public_html/plugins/stripe/payment.js';
import {createPluginHost} from '../public_html/dyws/plugins.js';
const doc={createElement:()=>({}),head:{append(){}}};
const order={id:'SG-000000000001',paymentProvider:'stripe',paymentStatus:'unpaid',status:'placed'};
test('Stripe plugin uses scoped checkout and permits only its hosted payment URL',async()=>{
 let button,request,navigation,error;
 const render=(url)=>renderStripePayment({document:doc,order,container:{append:n=>button=n},trackingToken:'private-token',onError:value=>error=value,navigate:url=>navigation=url,api:async(...args)=>{request=args;return {url};}});
 render('https://checkout.stripe.com/c/pay/test');await button.onclick();
 assert.equal(request[0],'/plugins/stripe/orders/'+order.id+'/checkout');assert.equal(request[1].trackingToken,'private-token');assert.equal(navigation,'https://checkout.stripe.com/c/pay/test');
 navigation=null;render('https://evil.test/checkout');await button.onclick();assert.equal(navigation,null);assert.equal(error,'Invalid payment link.');assert.equal(button.disabled,false);
});
test('Pending Stripe payments offer status instead of a second checkout',()=>{
 let node;renderStripePayment({document:doc,order:{...order,checkoutStatus:'pending'},container:{append:n=>node=n}});assert.match(node.textContent,/Do not place a duplicate order/);assert.equal(node.onclick,undefined);
});
test('Inactive payment plugin keeps tracking useful without offering manual capture',async()=>{
 const host=await createPluginHost({api:async()=>({plugins:[]}),document:doc});let node;
 host.renderPayment({order:{...order,checkoutStatus:'pending'},container:{append:n=>node=n}});assert.match(node.textContent,/confirmation is pending/);assert.equal(node.onclick,undefined);
});
