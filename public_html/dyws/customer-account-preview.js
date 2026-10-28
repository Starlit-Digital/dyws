import {escapeHTML as esc} from './api.js';

/** Fictional presentation only. These records are never stored or sent to an API. */
export function customerPreviewOrders(storeName){
 const common={status:'delivered',paymentStatus:'paid',fulfillment:'delivery',fulfillmentMeta:{label:'Delivery'},orderLocation:{name:storeName},currency:'CAD',deliveryAddress:'123 Example Avenue NW, Edmonton, AB T5A 1A1',subtotal:1495,deliveryFee:395,tax:95,tip:200,total:2185,lines:[{quantity:1,name:'Example meal',option:'',price:1495}],canReport:true};
 return [
  {...common,id:'DEMO-000000000001',createdAt:1793116800,driver:{id:'demo-driver-one',name:'Demo Driver One',vehicleColor:'Blue',vehicleType:'Sedan'},report:null,driverBlocked:false},
  {...common,id:'DEMO-000000000002',createdAt:1793113200,status:'out_for_delivery',subtotal:2390,tax:139,tip:300,total:3224,lines:[{quantity:1,name:'Example meal',option:'',price:1495},{quantity:1,name:'Example side',option:'',price:895}],driver:{id:'demo-driver-three',name:'Demo Driver Three',vehicleColor:'Silver',vehicleType:'Hatchback'},canReport:false,report:null,driverBlocked:false},
  {...common,id:'DEMO-000000000003',createdAt:1793030400,driver:{id:'demo-driver-two',name:'Demo Driver Two',vehicleColor:'White',vehicleType:'SUV'},report:{reason:'handling',details:'Example report: the order arrived damaged.'},driverBlocked:true}
 ];
}
export function customerAccountPreviewHTML({storeName,ordersURL}){
 return `<p>Explore the fictional account for <strong>Demo Customer</strong>.</p><p><a href="${esc(ordersURL)}">View my orders</a></p><fieldset disabled class="dyws-account-preview"><legend>Customer account preview</legend>
 <section aria-labelledby="demo-account-details"><h2 id="demo-account-details">Customer details</h2><form><label>Name<input name="customer" value="Demo Customer" autocomplete="off"></label><label>Email<input name="email" type="email" value="demo.customer@example.test" autocomplete="off"></label><label>Phone<input name="phone" type="tel" value="7805550142" autocomplete="off"></label><label>Delivery address<input name="address" value="123 Example Avenue NW, Edmonton, AB T5A 1A1" autocomplete="off"></label><p>Example account for ${esc(storeName)}.</p><button type="button">Email me a sign in link</button><p>No password needed. Your first verified sign in creates your account automatically.</p></form></section>
 <div class="dyws-actions"><button type="button" data-logout>Sign out</button></div>
 <section><h2>Blocked drivers</h2><p>Blocks apply to every delivery address when you order with this account at this store.</p><ul data-blocks role="list"><li>Demo Driver Two <button type="button" data-unblock="demo-driver-two">Unblock</button></li></ul></section>
 </fieldset>`;
}
