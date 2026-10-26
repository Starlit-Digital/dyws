import test from 'node:test';
import assert from 'node:assert/strict';
import {createPluginHost} from '../public_html/dyws/plugins.js';

test('Missing external payment plugin keeps tracking useful without offering manual capture',async()=>{
 const document={createElement:()=>({}),head:{append(){}}};
 const host=await createPluginHost({api:async()=>({plugins:[]}),document});let node;
 host.renderPayment({order:{id:'DYWS-000000000001',paymentProvider:'external',paymentStatus:'unpaid',status:'placed',checkoutStatus:'pending'},container:{append:value=>node=value}});
 assert.match(node.textContent,/confirmation is pending/);
 assert.equal(node.onclick,undefined);
});
