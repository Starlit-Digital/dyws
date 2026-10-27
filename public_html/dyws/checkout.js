import {mountPickup} from './pickup.js';
import {tipCents} from './tips.js';
import {deliveryCharge,locationPolicy,isOrderingOpen,scheduleText} from './business-policy.js';
import {mountGuestDetails,rememberPreference} from './guest-details.js';
import {captureCheckout,restoreCheckout} from './checkout-draft.js';
import {formatPhoneField} from './phone-input.js';
import {readCatalog} from './catalog-data.js';
import {restoreCart,totals} from './cart.js';
import {frameCheckoutFields,fieldError,validateFields,clearFieldError} from './checkout-fields.js';
const escapeHTML = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatPostalCode = value => {const postal=String(value??'').trim();return /^[a-z]\d[a-z]\s?\d[a-z]\d$/i.test(postal)?postal.replace(/\s/g,'').toUpperCase().replace(/^(.{3})(.{3})$/,'$1 $2'):postal;};
export async function mountCheckout(){
    this.pickup?.destroy();this.pickup=null;
    if(this.getAttribute('catalog')){try{this.catalog=await readCatalog(this,{fresh:true});this.lines=restoreCart(this.catalog,this.lines);this.persist();}catch{this.shadowRoot.querySelector('.dyws-content').insertAdjacentHTML('beforeend','<p role="alert">Unable to check current prices and ordering hours. Please try again.</p>');return;}}
    if(!this.lines.length){this.showCart();return;}
    const t=totals(this.lines,this.catalog.taxBasisPoints);const content=this.shadowRoot.querySelector('.dyws-content');
    const configuredLocations=this.catalog.locations||[],locations=configuredLocations.length?configuredLocations.filter(location=>location.active):[{id:'',name:this.catalog.businessName||this.catalog.restaurant||'Business',address:this.catalog.pickupAddress||'',phone:this.catalog.businessPhone||''}];
    content.innerHTML=`<form novalidate><label data-dyws-order-field="location" ${locations.length===1?'hidden':''}>Store<select name="locationId" ${configuredLocations.length?'required':''}>${locations.map(location=>`<option value="${escapeHTML(location.id)}">${escapeHTML(location.name)}${location.address?' · '+escapeHTML(location.address):''}</option>`).join('')}</select></label><div class="dyws-checkout-hours" data-dyws-hours></div><div class="dyws-checkout-grid"><label data-dyws-order-field="name">Name<input name="customer" required maxlength="100" autocomplete="off"></label><label data-dyws-order-field="phone">Phone<input name="phone" type="tel" required pattern="[0-9+() .-]{7,30}" maxlength="30" autocomplete="off"></label></div><fieldset class="dyws-fulfillment" data-dyws-order-field="fulfillment"><legend class="dyws-visually-hidden">Order type</legend><div class="dyws-pillbox"><label><input type="radio" name="fulfillment" value="pickup" aria-label="Pickup" checked><span>Pickup</span></label><label><input type="radio" name="fulfillment" value="delivery" aria-label="Delivery"><span>Delivery</span></label></div></fieldset><fieldset class="dyws-delivery-address" aria-label="Delivery address" hidden disabled><div class="dyws-checkout-grid"><label class="dyws-address-street" data-dyws-order-field="street" data-dyws-delivery>Address<input name="addressLine1" required maxlength="120" autocomplete="address-line1"></label><label data-dyws-order-field="unit" data-dyws-delivery>Unit (optional)<input name="addressLine2" maxlength="60" autocomplete="address-line2"></label><input type="hidden" name="addressPostal"></div></fieldset><div data-dyws-order-field="notes"><button type="button" class="dyws-note-add dyws-muted" aria-expanded="false" aria-controls="dyws-note-field">Add note</button><label id="dyws-note-field" hidden>Note<textarea name="notes" maxlength="500"></textarea></label></div><p class="dyws-pickup-location" data-dyws-order-field="pickup">Pickup: <a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(this.catalog.pickupAddress || this.catalog.businessName || this.catalog.restaurant)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHTML(this.catalog.pickupAddress || this.catalog.businessName || this.catalog.restaurant)}, Google Maps, opens in a new tab">${escapeHTML(this.catalog.pickupAddress || this.catalog.businessName || this.catalog.restaurant)} ↗</a></p><div data-dyws-order-field="total"><div class="dyws-tip"><input type="hidden" name="addTip" value="0"><button type="button" class="dyws-tip-add dyws-muted" aria-controls="dyws-tip-amount" aria-expanded="false">Add tip</button><div id="dyws-tip-amount" class="dyws-tip-editor" hidden><span aria-hidden="true">$</span><input name="tipDollars" type="text" inputmode="numeric" pattern="[0-9]+" maxlength="6" autocomplete="off" aria-label="Tip amount in ${escapeHTML(this.catalog.currency)}, whole dollars" placeholder="Tip" disabled><button type="button" class="dyws-tip-remove dyws-muted" aria-label="Remove tip" title="Remove tip"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6"/></svg></button></div></div><p><strong class="dyws-checkout-total">Total ${this.amount(t.total)}</strong></p></div><div data-dyws-checkout-fields></div><p role="alert" class="dyws-error"></p><div class="dyws-actions" data-dyws-order-field="actions"><button type="button" class="dyws-muted dyws-back">Back</button><button type="submit" aria-label="Review order">Review</button></div></form>`;
    content.querySelector('.dyws-back').onclick=()=>{this.checkoutDraft=captureCheckout(content.querySelector('form'));this.showCart();};
    const form=content.querySelector('form');
    form.querySelectorAll('button').forEach(button=>button.disabled=true);
    form.addEventListener('input',formatPhoneField);
    form.addEventListener('input',event=>clearFieldError(event.target));
    form.addEventListener('change',event=>clearFieldError(event.target));
    const revealNote=()=>{form.querySelector('#dyws-note-field').hidden=false;form.querySelector('.dyws-note-add').hidden=true;form.querySelector('.dyws-note-add').setAttribute('aria-expanded','true');};
    form.querySelector('.dyws-note-add').onclick=()=>{revealNote();form.elements.notes.focus();};
    const orderType=form.querySelector('.dyws-fulfillment'),customerFields=form.elements.customer.closest('.dyws-checkout-grid');
    if(orderType&&customerFields)customerFields.before(orderType);
    const selectedLocation=()=>locations.find(location=>location.id===form.elements.locationId.value);
    this.pickup=mountPickup({form,catalog:this.catalog,selectedLocation,plugins:this.plugins,api:this.pickupAPI});
    form.elements.locationId.onchange=()=>{const location=selectedLocation(),policy=locationPolicy(this.catalog,location);
     const hours=form.querySelector('[data-dyws-hours]'),open=this.catalog.acceptingOrders!==false&&isOrderingOpen(policy.orderingHours,this.catalog.timeZone);
     hours.innerHTML=`${!open?'<p role="status">'+(this.catalog.acceptingOrders===false?'Online ordering is temporarily paused.':'Online ordering is currently closed for this location.')+'</p>':''}${['locationHours','orderingHours'].filter(key=>policy[key]?.enabled).map(key=>`<details><summary>${key==='locationHours'?'Location hours':'Ordering hours'} (${escapeHTML(this.catalog.timeZone||'America/Edmonton')})</summary><p>${escapeHTML(scheduleText(policy[key]))}</p></details>`).join('')}`;
     form.querySelector('.dyws-fulfillment').onchange?.();const link=form.querySelector('.dyws-pickup-location a');if(link){const address=location?.address||location?.name||'Choose a location';link.textContent=address;if(location){link.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(address);link.setAttribute('aria-label',address+', Google Maps, opens in a new tab');}else{link.removeAttribute('href');link.removeAttribute('aria-label');}}};
    form.elements.locationId.onchange();
    const pluginData={};let fieldsReady=false;
    form.querySelector('.dyws-fulfillment').onchange=()=>{this.pickup?.sync();const delivery=form.elements.fulfillment.value==='delivery';const address=form.querySelector('.dyws-delivery-address');if(address){address.hidden=!delivery;address.disabled=!delivery;}for(const label of form.querySelectorAll('[data-dyws-delivery]')){label.hidden=!delivery;label.querySelectorAll('input').forEach(input=>input.disabled=!delivery);if(label.parentElement.classList.contains('dyws-order-cell'))label.parentElement.hidden=!delivery;}const pickup=form.querySelector('.dyws-pickup-location');if(pickup){pickup.hidden=delivery;if(pickup.parentElement.classList.contains('dyws-order-cell'))pickup.parentElement.hidden=delivery;}const fee=deliveryCharge(this.catalog,t.subtotal,delivery?'delivery':'pickup',selectedLocation());const total=t.subtotal+fee+Math.round((t.subtotal+fee)*this.catalog.taxBasisPoints/10000)+((form.elements.addTip.value==='1')&&/^[0-9]{1,6}$/.test(form.elements.tipDollars.value)?tipCents(form.elements.tipDollars.value):0);form.querySelector('.dyws-checkout-total').textContent=(delivery?'Delivery '+this.amount(fee)+' · ':'')+'Total '+this.amount(total);};
    const syncTip=(focus=false)=>{const enabled=form.elements.addTip.value==='1',input=form.elements.tipDollars;form.querySelector('#dyws-tip-amount').hidden=!enabled;input.disabled=!enabled;input.required=enabled;const add=form.querySelector('.dyws-tip-add');add.hidden=enabled;add.setAttribute('aria-expanded',String(enabled));form.querySelector('.dyws-fulfillment').onchange();if(focus&&enabled)input.focus();};
    form.querySelector('.dyws-tip-add').onclick=()=>{form.elements.addTip.value='1';syncTip(true);};
    form.querySelector('.dyws-tip-remove').onclick=()=>{form.elements.addTip.value='0';form.elements.tipDollars.value='';syncTip();form.querySelector('.dyws-tip-add').focus();};
    form.elements.tipDollars.oninput=()=>syncTip();
    form.onsubmit=async event=>{
      event.preventDefault();if(this.busy||this.reviewPanel||!fieldsReady)return;
      form.querySelector('.dyws-error').textContent='';if(!validateFields(form))return;
      const values=new FormData(form);if(!values.get('customer').trim()){fieldError(form.elements.customer,'Enter a name.');return;}
      const location=selectedLocation();if(!location){fieldError(form.elements.locationId,'Choose a store.');return;}
      if(this.catalog.acceptingOrders===false){form.querySelector('.dyws-error').textContent='Online ordering is temporarily paused. Please try again later.';return;}
      if(!isOrderingOpen(locationPolicy(this.catalog,location).orderingHours,this.catalog.timeZone)){form.querySelector('.dyws-error').textContent='Online ordering is closed for this location. Please check its ordering hours.';return;}
      this.busy=true;form.inert=true;this.shadowRoot.querySelector('.dyws-close').disabled=true;form.querySelectorAll('button').forEach(b=>b.disabled=true);
      const addressDetails=values.get('fulfillment')==='delivery'?Object.fromEntries([['line1','addressLine1'],['line2','addressLine2'],['postalCode','addressPostal'],['city','addressCity'],['region','addressRegion'],['country','addressCountry']].map(([key,field])=>[key,String(values.get(field)||'').trim()])):undefined;
      const streetInput=form.elements.addressLine1;
      if(addressDetails&&streetInput?.dataset.dywsAddressDisplay===streetInput.value)addressDetails.line1=streetInput.dataset.dywsAddressLine1;
      if(addressDetails)addressDetails.postalCode=formatPostalCode(addressDetails.postalCode);
      const order={locationId:location.id,orderLocation:location,businessName:this.catalog.businessName || this.catalog.restaurant,currency:this.catalog.currency,lines:this.lines.map(l=>({...l})),...t,customerAccountRequired:!!this.customerAccountId,customerAccountId:this.customerAccountId||undefined,customer:{name:values.get('customer').trim(),phone:values.get('phone').trim()},notes:String(values.get('notes')||'').trim(),fulfillment:values.get('fulfillment'),pluginData,rememberDetails:rememberPreference(form),addressDetails,address:addressDetails?[addressDetails.line1,addressDetails.line2,addressDetails.city,addressDetails.region,addressDetails.postalCode,addressDetails.country].filter(Boolean).join(', '):''};
      try {
      Object.assign(order,await this.pickup.read());
      order.tip=tipCents(form.elements.tipDollars.value,(form.elements.addTip.value==='1'));
      await this.plugins?.validate('checkout:validating',{form,order,pluginData});
      if(!this.isConnected||!this.dialog.open)return;
      const fingerprint=JSON.stringify(order);if(this.pendingFingerprint!==fingerprint){this.pendingFingerprint=fingerprint;this.pendingKey=crypto.randomUUID();}order.idempotencyKey=this.pendingKey;const fee=deliveryCharge(this.catalog,t.subtotal,order.fulfillment,location);order.deliveryFee=fee;order.tax=Math.round((t.subtotal+fee)*this.catalog.taxBasisPoints/10000);order.total=t.subtotal+fee+order.tax+order.tip;
      this.reviewOrder({order,form,content});
      }catch(error){form.querySelector('.dyws-error').textContent=error.message||'Unable to review. Your cart has been kept.';}
      finally{form.inert=false;if(!this.reviewPanel)form.querySelector('[aria-invalid="true"]')?.focus();this.busy=false;this.shadowRoot.querySelector('.dyws-close').disabled=false;form.querySelectorAll('button').forEach(b=>b.disabled=false);}
    };
    if(this.plugins){
     const buttons=[...form.querySelectorAll('button')];buttons.forEach(button=>button.disabled=true);
     await this.plugins.runAction('checkout:fields',{root:form.querySelector('[data-dyws-checkout-fields]'),form,pluginData});
    }
    this.applyLayout('checkout',form);
    restoreCheckout(form,this.checkoutDraft||[]);syncTip();form.elements.locationId.onchange();form.querySelector('.dyws-fulfillment').onchange();
    this.customerAccountId=null;
    if(this.customerAPI){
     const accountNote=document.createElement('p');accountNote.className='dyws-note';form.prepend(accountNote);
     try{const state=await this.customerAPI('/customer/session');this.customerAccountId=state.customer?.id||null;
      if(state.customer)accountNote.textContent='Order as '+state.customer.email+'. Saved to your account.';
      else if(state.enabled)accountNote.innerHTML=`<a href="${escapeHTML(this.accountURL)}" target="_blank" rel="noopener noreferrer">Sign in for order history and driver preferences</a>`;
     }catch{accountNote.textContent='Account sign in is unavailable. You can continue as a guest.';}
    }
    const saved=await mountGuestDetails({form,api:this.guestAPI,termsURL:this.termsURL,hasDraft:!!this.checkoutDraft,onForget:()=>{this.checkoutDraft=null;}});
    if(!form.isConnected)return;
    restoreCheckout(form,(this.checkoutDraft||[]).filter(field=>['rememberDetails','savedProfileId','savedAddressId','addressLabel','customAddressLabel','defaultAddress'].includes(field.name)));
    saved?.afterRestore(this.checkoutDraft);saved?.sync();form.elements.locationId.onchange();form.querySelector('.dyws-fulfillment').onchange();
    if(form.elements.notes?.value)revealNote();
    frameCheckoutFields(form);fieldsReady=true;form.querySelectorAll('button').forEach(button=>button.disabled=false);form.elements.customer.focus();
  }
