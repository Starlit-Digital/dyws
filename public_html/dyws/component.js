import {mountGuestDetails,rememberPreference} from './guest-details.js';
import {captureCheckout,restoreCheckout} from './checkout-draft.js';
import {splitAddress} from './address-lines.js';
import {formatPhoneField} from './phone-input.js';
import {readCatalog} from './catalog-data.js';
import {lineKey,resolveItem,restoreCart,totals,itemOrderCap,itemQuantity} from './cart.js';
import {createConfirmationCountdown} from './confirmation-countdown.js';
import {applyOrderLayout} from './order-layout.js';
const escapeHTML = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatPhone = value => {const phone=String(value??'');const digits=phone.replace(/\D/g,'').replace(/^1(?=\d{10}$)/,'');return digits.length===10?`(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`:phone;};
const formatPostalCode = value => {const postal=String(value??'').trim();return /^[a-z]\d[a-z]\s?\d[a-z]\d$/i.test(postal)?postal.replace(/\s/g,'').toUpperCase().replace(/^(.{3})(.{3})$/,'$1 $2'):postal;};
export class DYWSOrdering extends HTMLElement {
  constructor(){super();this.attachShadow({mode:'open'});this.lines=[];this.busy=false;}
  async connectedCallback(){
    this.shadowRoot.innerHTML='<p role="status">Loading ordering…</p>';
    try {
      this.catalog=await readCatalog(this);
      if(!Array.isArray(this.catalog.categories)) throw new Error('Catalog unavailable');
      this.money=new Intl.NumberFormat('en-CA',{style:'currency',currency:this.catalog.currency,useGrouping:true});
      try {this.lines=restoreCart(this.catalog,JSON.parse(localStorage.getItem(this.key)||'[]'));}catch{}
      this.render();this.dispatchEvent(new CustomEvent('ordering-ready',{bubbles:true}));
    } catch {this.shadowRoot.innerHTML='<p role="alert">Ordering is unavailable. Please try again later.</p>';}
  }
  get key(){return this.getAttribute('storage-key')||'dyws-cart';}
  disconnectedCallback(){this.cancelReview();}
  cancelReview(){this.reviewCountdown?.cancel();this.reviewCountdown=null;this.reviewVisibility?.disconnect();this.reviewVisibility=null;this.reviewPanel?.remove();this.reviewPanel=null;const form=this.shadowRoot.querySelector('form');if(form)form.hidden=false;}
  applyLayout(stage,root){return applyOrderLayout({stage,root,layout:this.plugins?.orderLayout?.(stage)});}
  amount(value){return this.money.format(value/100);}
  persist(){try{localStorage.setItem(this.key,JSON.stringify(this.lines));}catch{} this.updateButton();this.dispatchEvent(new CustomEvent('cart-change',{detail:{count:this.lines.reduce((n,l)=>n+l.quantity,0)},bubbles:true}));void this.plugins?.runAction('cart:updated',{lines:this.lines.map(line=>({...line})),totals:totals(this.lines,this.catalog.taxBasisPoints)});}
  updateButton(){const count=this.lines.reduce((n,l)=>n+l.quantity,0);this.shadowRoot.querySelector('.dyws-cart-launch').textContent=`Your order (${count}) · ${this.amount(totals(this.lines,this.catalog.taxBasisPoints).total)}`;}
  add(id,variant=''){
    if(!this.catalog || this.busy||this.reviewCountdown)return;
    const item=resolveItem(this.catalog,id,variant);const key=lineKey(id,variant);
    const row=this.lines.find(l=>lineKey(l.id,l.variant)===key);
    if(itemQuantity(this.lines,id)>=itemOrderCap(this.catalog)){this.showItemLimit();return;}
    if(row)row.quantity++;else this.lines.push({...item,quantity:1});
    this.persist();this.announce(`${item.name} added to your order.`);
  }
  remove(id,variant=''){
    if(!this.catalog || this.busy||this.reviewCountdown)return;
    const row=this.lines.find(line=>lineKey(line.id,line.variant)===lineKey(id,variant));
    if(!row)return;
    row.quantity--;
    this.lines=this.lines.filter(line=>line.quantity>0);
    this.persist();this.announce(`${row.name} quantity ${row.quantity}.`);
  }
  announce(text){this.shadowRoot.querySelector('[role="status"]').textContent=text;}
  render(){
    this.shadowRoot.innerHTML=`<link rel="stylesheet" href="${new URL('./ordering.css?v=50',import.meta.url).href}"><div class="dyws-ordering"><button class="dyws-cart-launch" type="button">Your order</button><p id="dyws-status" role="status" aria-live="polite"></p><dialog aria-labelledby="dyws-order-title"><header><div class="dyws-store-brand"><slot name="site-logo"></slot><span>${escapeHTML(this.catalog.businessName || this.catalog.restaurant || '')}</span></div><h2 id="dyws-order-title">Your Order</h2><button type="button" class="dyws-muted dyws-close" aria-label="Close order">Close</button></header><div class="dyws-content"></div></dialog></div>`;
    this.dialog=this.shadowRoot.querySelector('dialog');
    this.shadowRoot.querySelector('.dyws-cart-launch').onclick=()=>this.open();
    this.shadowRoot.querySelector('.dyws-close').onclick=()=>this.dialog.close();
    this.dialog.addEventListener('cancel',e=>{if(this.busy)e.preventDefault();});
    this.dialog.addEventListener('close',()=>{const form=this.shadowRoot.querySelector('form');if(form)this.checkoutDraft=captureCheckout(form);this.cancelReview();});
    this.updateButton();
  }
  open(){this.showCart();this.dialog.showModal();}
  showItemLimit(){
    this.showCart();
    const content=this.shadowRoot.querySelector('.dyws-content');
    const phone=String(this.catalog.businessPhone||'');
    const dial=/^[0-9+() .-]{7,30}$/.test(phone)?phone.replace(/[^0-9+]/g,''):'';
    const displayPhone=formatPhone(phone);
    const notice=document.createElement('div');notice.className='dyws-cap-notice';notice.tabIndex=-1;notice.setAttribute('role','alert');
    notice.innerHTML=`<p>Online orders are limited to ${itemOrderCap(this.catalog)} of each item. Please call the store for a larger order.</p>${dial?`<a href="tel:${escapeHTML(dial)}">Call ${escapeHTML(displayPhone)}</a>`:''}`;
    content.prepend(notice);if(!this.dialog.open)this.dialog.showModal();notice.focus();
  }
  showCart(){
    this.cancelReview();
    const content=this.shadowRoot.querySelector('.dyws-content');const t=totals(this.lines,this.catalog.taxBasisPoints);
    content.innerHTML=this.lines.length?'<div data-dyws-order-field="items">'+this.lines.map((l,n)=>`<div class="dyws-line"><div class="dyws-line-info"><strong>${escapeHTML(l.name)}</strong>${escapeHTML(l.option)} <span>${this.amount(l.price*l.quantity)}</span></div><div class="dyws-quantity"><button data-change="${n}" data-delta="-1" aria-label="${l.quantity===1?'Remove':'Remove one'} ${escapeHTML(l.name)}">${l.quantity===1?'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6"/></svg>':'−'}</button><span aria-label="Quantity">${l.quantity}</span><button data-change="${n}" data-delta="1" aria-label="Add one ${escapeHTML(l.name)}">+</button></div></div>`).join('')+`</div><div class="dyws-summary-panel"><dl class="dyws-summary"><div class="dyws-order-pair" data-dyws-order-field="subtotal"><dt>Subtotal</dt><dd>${this.amount(t.subtotal)}</dd></div><div class="dyws-order-pair" data-dyws-order-field="tax"><dt>Tax (${this.catalog.taxBasisPoints/100}%)</dt><dd>${this.amount(t.tax)}</dd></div></dl><p class="dyws-grand-total" data-dyws-order-field="total">Total ${this.amount(t.total)}</p></div><button data-dyws-order-field="actions" class="dyws-checkout" type="button">Continue to checkout</button>`:'<p>Your order is empty. Add something from the catalog.</p>';
    if(this.lines.length)this.applyLayout('cart',content);
    content.querySelectorAll('[data-change]').forEach(b=>b.onclick=()=>{const n=Number(b.dataset.change);if(Number(b.dataset.delta)>0&&itemQuantity(this.lines,this.lines[n].id)>=itemOrderCap(this.catalog)){this.showItemLimit();return;}this.lines[n].quantity+=Number(b.dataset.delta);this.lines=this.lines.filter(l=>l.quantity>0);this.persist();this.showCart();});
    content.querySelector('.dyws-checkout')?.addEventListener('click',()=>this.checkout());
  }
  async checkout(){
    const t=totals(this.lines,this.catalog.taxBasisPoints);const content=this.shadowRoot.querySelector('.dyws-content');
    const configuredLocations=this.catalog.locations||[],locations=configuredLocations.length?configuredLocations.filter(location=>location.active):[{id:'',name:this.catalog.businessName||this.catalog.restaurant||'Business',address:this.catalog.pickupAddress||'',phone:this.catalog.businessPhone||''}];
    content.innerHTML=`<form><label data-dyws-order-field="location"><select aria-label="Pickup location" name="locationId" ${configuredLocations.length?'required':''}>${locations.map(location=>`<option value="${escapeHTML(location.id)}">${escapeHTML(location.name)}${location.address?' · '+escapeHTML(location.address):''}</option>`).join('')}</select></label><div class="dyws-checkout-grid"><label data-dyws-order-field="name">Name<input name="customer" required maxlength="100" autocomplete="off"></label><label data-dyws-order-field="phone">Phone number<input name="phone" type="tel" required pattern="[0-9+() .-]{7,30}" maxlength="30" autocomplete="off"></label></div><fieldset class="dyws-fulfillment" data-dyws-order-field="fulfillment"><legend class="dyws-visually-hidden">Order type</legend><div class="dyws-pillbox"><label><input type="radio" name="fulfillment" value="pickup" aria-label="Pickup" checked><span>Pickup</span></label><label><input type="radio" name="fulfillment" value="delivery" aria-label="Delivery"><span>Delivery</span></label></div></fieldset><fieldset class="dyws-delivery-address" aria-label="Delivery address" hidden disabled><div class="dyws-checkout-grid"><label class="dyws-address-street" data-dyws-order-field="street" data-dyws-delivery>Street address<input name="addressLine1" required maxlength="120" autocomplete="address-line1"></label><label data-dyws-order-field="unit" data-dyws-delivery>Unit<input name="addressLine2" maxlength="60" autocomplete="address-line2"></label><input type="hidden" name="addressPostal"></div></fieldset><label data-dyws-order-field="notes">Order notes, optional<textarea name="notes" maxlength="500"></textarea></label><p class="dyws-pickup-location" data-dyws-order-field="pickup">Pickup at <a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(this.catalog.pickupAddress || this.catalog.businessName || this.catalog.restaurant)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHTML(this.catalog.pickupAddress || this.catalog.businessName || this.catalog.restaurant)}, Google Maps, opens in a new tab">${escapeHTML(this.catalog.pickupAddress || this.catalog.businessName || this.catalog.restaurant)} ↗</a></p><p data-dyws-order-field="total"><strong class="dyws-checkout-total">Total ${this.amount(t.total)}</strong></p><div data-dyws-checkout-fields></div><p role="alert" class="dyws-error"></p><div class="dyws-actions" data-dyws-order-field="actions"><button type="button" class="dyws-muted dyws-back">Back</button><button type="submit">Review order</button></div></form>`;
    content.querySelector('.dyws-back').onclick=()=>{this.checkoutDraft=captureCheckout(content.querySelector('form'));this.showCart();};
    const form=content.querySelector('form');
    form.addEventListener('input',formatPhoneField);
    const orderType=form.querySelector('.dyws-fulfillment'),customerFields=form.elements.customer.closest('.dyws-checkout-grid');
    if(orderType&&customerFields)customerFields.before(orderType);
    const selectedLocation=()=>locations.find(location=>location.id===form.elements.locationId.value);
    form.elements.locationId.onchange=()=>{const location=selectedLocation(),link=form.querySelector('.dyws-pickup-location a');if(link){const address=location?.address||location?.name||'Choose a location';link.textContent=address;if(location){link.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(address);link.setAttribute('aria-label',address+', Google Maps, opens in a new tab');}else{link.removeAttribute('href');link.removeAttribute('aria-label');}}};
    form.elements.locationId.onchange();
    const pluginData={};let fieldsReady=!this.plugins;
    form.querySelector('.dyws-fulfillment').onchange=()=>{const delivery=form.elements.fulfillment.value==='delivery';const address=form.querySelector('.dyws-delivery-address');if(address){address.hidden=!delivery;address.disabled=!delivery;}for(const label of form.querySelectorAll('[data-dyws-delivery]')){label.hidden=!delivery;label.querySelectorAll('input').forEach(input=>input.disabled=!delivery);if(label.parentElement.classList.contains('dyws-order-cell'))label.parentElement.hidden=!delivery;}const pickup=form.querySelector('.dyws-pickup-location');if(pickup){pickup.hidden=delivery;if(pickup.parentElement.classList.contains('dyws-order-cell'))pickup.parentElement.hidden=delivery;}const fee=delivery?(this.catalog.deliveryFee ?? 395):0;const total=t.subtotal+fee+Math.round((t.subtotal+fee)*this.catalog.taxBasisPoints/10000);form.querySelector('.dyws-checkout-total').textContent='Total '+this.amount(total);};
    form.onsubmit=async event=>{
      event.preventDefault();if(this.busy||this.reviewCountdown||!fieldsReady||!form.reportValidity())return;
      const values=new FormData(form);if(!values.get('customer').trim()){content.querySelector('.dyws-error').textContent='Enter a name.';return;}
      const location=selectedLocation();if(!location){form.querySelector('.dyws-error').textContent='Choose an available location.';return;}
      this.busy=true;this.shadowRoot.querySelector('.dyws-close').disabled=true;form.querySelectorAll('button').forEach(b=>b.disabled=true);
      const addressDetails=values.get('fulfillment')==='delivery'?Object.fromEntries([['line1','addressLine1'],['line2','addressLine2'],['postalCode','addressPostal'],['city','addressCity'],['region','addressRegion'],['country','addressCountry']].map(([key,field])=>[key,String(values.get(field)||'').trim()])):undefined;
      const streetInput=form.elements.addressLine1;
      if(addressDetails&&streetInput?.dataset.dywsAddressDisplay===streetInput.value)addressDetails.line1=streetInput.dataset.dywsAddressLine1;
      if(addressDetails)addressDetails.postalCode=formatPostalCode(addressDetails.postalCode);
      const order={locationId:location.id,orderLocation:location,businessName:this.catalog.businessName || this.catalog.restaurant,currency:this.catalog.currency,lines:this.lines.map(l=>({...l})),...t,customer:{name:values.get('customer').trim(),phone:values.get('phone').trim()},notes:String(values.get('notes')||'').trim(),fulfillment:values.get('fulfillment'),pluginData,rememberDetails:rememberPreference(form),addressDetails,address:addressDetails?[addressDetails.line1,addressDetails.line2,addressDetails.city,addressDetails.region,addressDetails.postalCode,addressDetails.country].filter(Boolean).join(', '):''};
      try {
      await this.plugins?.validate('checkout:validating',{form,order,pluginData});
      if(!this.isConnected||!this.dialog.open)return;
      const fingerprint=JSON.stringify(order);if(this.pendingFingerprint!==fingerprint){this.pendingFingerprint=fingerprint;this.pendingKey=crypto.randomUUID();}order.idempotencyKey=this.pendingKey;const fee=order.fulfillment==='delivery'?(this.catalog.deliveryFee ?? 395):0;order.deliveryFee=fee;order.tax=Math.round((t.subtotal+fee)*this.catalog.taxBasisPoints/10000);order.total=t.subtotal+fee+order.tax;
      this.reviewOrder({order,form,content});
      }catch(error){form.querySelector('.dyws-error').textContent=error.message||'Unable to review. Your cart has been kept.';}
      finally{this.busy=false;this.shadowRoot.querySelector('.dyws-close').disabled=false;form.querySelectorAll('button').forEach(b=>b.disabled=false);}
    };
    if(this.plugins){
     const buttons=[...form.querySelectorAll('button')];buttons.forEach(button=>button.disabled=true);
     await this.plugins.runAction('checkout:fields',{root:form.querySelector('[data-dyws-checkout-fields]'),form,pluginData});
     buttons.forEach(button=>button.disabled=false);
    }
    this.applyLayout('checkout',form);
    restoreCheckout(form,this.checkoutDraft||[]);form.elements.locationId.onchange();form.querySelector('.dyws-fulfillment').onchange();
    const saved=await mountGuestDetails({form,api:this.guestAPI,termsURL:this.termsURL,hasDraft:!!this.checkoutDraft,onForget:()=>{this.checkoutDraft=null;}});
    if(!form.isConnected)return;
    restoreCheckout(form,(this.checkoutDraft||[]).filter(field=>['rememberDetails','savedProfileId','savedAddressId','addressLabel','customAddressLabel','defaultAddress'].includes(field.name)));
    saved?.afterRestore(this.checkoutDraft);saved?.sync();form.elements.locationId.onchange();form.querySelector('.dyws-fulfillment').onchange();
    fieldsReady=true;form.querySelector('input').focus();
  }
  reviewOrder({order,form,content}){
    this.cancelReview();form.hidden=true;
    const review=document.createElement('section');this.reviewPanel=review;review.className='dyws-final-review';review.tabIndex=-1;review.setAttribute('aria-label','Order review');review.setAttribute('aria-describedby','dyws-review-notice');
    const pickupAddress=order.orderLocation?.address||this.catalog.pickupAddress||this.catalog.businessName||'the business';
    const addressHTML=(value,city='')=>splitAddress(value,city).map(escapeHTML).join('<br>');
    const deliveryStreet=[order.addressDetails?.line1,order.addressDetails?.line2].filter(Boolean).join(', ');
    const deliveryCity=[order.addressDetails?.city,order.addressDetails?.region,order.addressDetails?.postalCode].filter(Boolean).join(', ');
    const pickupLink=`<a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(pickupAddress)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHTML(pickupAddress)}, Google Maps, opens in a new tab">${addressHTML(pickupAddress)}</a>`;
    review.innerHTML=`<p data-dyws-order-field="location">${escapeHTML(order.orderLocation?.name||this.catalog.businessName||'')}${order.orderLocation?.address?'<br>'+pickupLink:''}</p><ul class="dyws-review-items" data-dyws-order-field="items">${order.lines.map(line=>`<li><span>${escapeHTML(line.quantity)} × ${escapeHTML(line.name)}${line.option?`<small>${escapeHTML(line.option)}</small>`:''}</span><strong>${this.amount(line.price*line.quantity)}</strong></li>`).join('')}</ul><dl class="dyws-review-charges"><div data-dyws-order-field="delivery" ${order.fulfillment==='delivery'?'':'hidden'}><dt>Delivery fee</dt><dd>${this.amount(order.deliveryFee)}</dd></div><div data-dyws-order-field="tax"><dt>Tax (${this.catalog.taxBasisPoints/100}%)</dt><dd>${this.amount(order.tax)}</dd></div></dl><div class="dyws-review-details"><p><span data-dyws-order-field="name">${escapeHTML(order.customer.name)}</span><br><span data-dyws-order-field="phone">${escapeHTML(formatPhone(order.customer.phone))}</span></p><p><span data-dyws-order-field="address">${order.fulfillment==='delivery'?'':'<strong>Pickup at</strong><br>'}${order.fulfillment==='delivery'?addressHTML(deliveryStreet)+(deliveryCity?'<br>'+escapeHTML(deliveryCity):''):pickupLink}</span><span data-dyws-order-field="postal" hidden></span></p><p data-dyws-order-field="notes" ${order.notes?'':'hidden'}><strong>Order notes</strong><br>${escapeHTML(order.notes)}</p></div><p class="dyws-grand-total" data-dyws-order-field="total">Total ${this.amount(order.total)}</p><p id="dyws-review-notice" class="dyws-review-notice" role="status" aria-live="polite" aria-atomic="true">Your order will be sent in 10 seconds. Choose Looks good! to send now, or Back to make changes.</p><div class="dyws-review-footer"><div data-dyws-order-field="actions" class="dyws-actions"><button type="button" class="dyws-review-back dyws-muted">Back</button><button data-dyws-order-field="pause" type="button" class="dyws-review-pause dyws-muted" aria-label="Pause automatic submission">10 sec</button><button type="button" class="dyws-review-confirm" aria-label="Looks good! Send order now">Looks good!</button></div></div>`;
    const customLayout=this.applyLayout('review',review);
    const actions=review.querySelector('.dyws-review-back').parentElement;actions.insertBefore(review.querySelector('.dyws-review-pause'),review.querySelector('.dyws-review-confirm'));
    content.append(review);review.focus();
    review.querySelector('.dyws-review-back').onclick=()=>{this.cancelReview();form.querySelector('button[type="submit"]').focus();};
    review.querySelector('.dyws-review-confirm').onclick=()=>this.reviewCountdown?.confirm();
    review.querySelector('.dyws-review-pause').onclick=()=>this.reviewCountdown?.toggle();
    this.reviewCountdown=createConfirmationCountdown({document:this.ownerDocument,onTick:seconds=>{review.querySelector('.dyws-review-pause').textContent=`${seconds} sec`;},onPause:()=>{
      review.querySelector('.dyws-review-notice').textContent='Take your time. Your order has not been sent. Choose Looks good! when you are ready.';
      const pause=review.querySelector('.dyws-review-pause');pause.textContent='Paused';pause.dataset.paused='true';pause.setAttribute('aria-label','Resume countdown');
    },onResume:()=>{review.querySelector('.dyws-review-pause').dataset.paused='false';review.querySelector('.dyws-review-pause').setAttribute('aria-label','Pause automatic submission');review.querySelector('.dyws-review-notice').textContent='Countdown resumed. Choose Back to edit or Looks good! to send now.';},onConfirm:()=>{void this.sendReviewedOrder({order,form,content,review});}});
    if(customLayout&&typeof IntersectionObserver==='function'){this.reviewVisibility=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.intersectionRatio<.99))this.reviewCountdown?.pause();},{threshold:1});this.reviewVisibility.observe(review.querySelector('.dyws-review-confirm'));}
  }
  async sendReviewedOrder({order,form,content,review}){
    if(this.busy||!this.dialog.open||!this.isConnected||this.reviewPanel!==review)return;
    this.reviewCountdown?.cancel();this.reviewCountdown=null;this.busy=true;this.shadowRoot.querySelector('.dyws-close').disabled=true;review.querySelectorAll('button').forEach(b=>b.disabled=true);
    review.querySelector('.dyws-review-notice').textContent='Sending your order…';
    try {
        if(typeof this.submitOrder!=='function') throw new Error('No checkout adapter is configured.');
        const result=await this.submitOrder(order);
        if(!result?.id)throw new Error('Order confirmation was not received.');
        this.checkoutDraft=null;this.lines=[];this.persist();
        content.innerHTML=`<h3>Order received</h3><p>Reference <strong>${escapeHTML(result.id)}</strong></p><p>Your order is saved. ${result.paymentProvider!=='demo'?'Continue to payment in the tracking panel on this page.':'Follow its status on this page.'}</p><button type="button" class="dyws-done">Back to items</button>`;
        content.querySelector('.dyws-done').onclick=()=>{this.dialog.close();this.dispatchEvent(new CustomEvent('order-confirmation-closed',{bubbles:true}));};
        this.dispatchEvent(new CustomEvent('order-complete',{detail:{id:result.id,demo:result.demo===true,trackingToken:result.trackingToken},bubbles:true}));
      }catch(error){this.cancelReview();form.querySelector('.dyws-error').textContent=error.message||'Unable to submit. Your cart has been kept.';form.querySelector('button[type="submit"]').focus();}
      finally{this.busy=false;this.shadowRoot.querySelector('.dyws-close').disabled=false;}
  }
}
customElements.define('dyws-ordering',DYWSOrdering);
