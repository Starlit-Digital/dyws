import {fulfillmentHTML} from './fulfillment.js';
import {locationPolicy} from './business-policy.js';
import {splitAddress} from './address-lines.js';
import {captureCheckout} from './checkout-draft.js';
import {createConfirmationCountdown} from './confirmation-countdown.js';
const escapeHTML = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatPhone = value => {const phone=String(value??'');const digits=phone.replace(/\D/g,'').replace(/^1(?=\d{10}$)/,'');return digits.length===10?`(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`:phone;};
export function showOrderReview({order,form,content}){
    this.cancelReview();form.hidden=true;
    const review=document.createElement('section');this.reviewPanel=review;review.className='dyws-final-review';review.tabIndex=-1;review.setAttribute('aria-label','Order review');review.setAttribute('aria-describedby','dyws-review-notice');
    const pickupAddress=order.orderLocation?.address||this.catalog.pickupAddress||this.catalog.businessName||'the business';
    const addressHTML=(value,city='')=>splitAddress(value,city).map(escapeHTML).join('<br>');
    const deliveryStreet=[order.addressDetails?.line1,order.addressDetails?.line2].filter(Boolean).join(', ');
    const deliveryCity=[order.addressDetails?.city,order.addressDetails?.region,order.addressDetails?.postalCode].filter(Boolean).join(', ');
    const pickupLink=`<a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(pickupAddress)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHTML(pickupAddress)}, Google Maps, opens in a new tab">${addressHTML(pickupAddress)}</a>`;
    review.innerHTML=`<div data-dyws-order-field="location" hidden></div><ul class="dyws-review-items" data-dyws-order-field="items">${order.lines.map(line=>`<li><span>${escapeHTML(line.quantity)} × ${escapeHTML(line.name)}${line.option?`<small>${escapeHTML(line.option)}</small>`:''}</span><strong>${this.amount(line.price*line.quantity)}</strong></li>`).join('')}<li><button type="button" class="dyws-edit" data-edit="items">Edit items</button></li></ul><dl class="dyws-review-charges"><div data-dyws-order-field="delivery" ${order.fulfillment==='delivery'?'':'hidden'}><dt>Delivery</dt><dd>${this.amount(order.deliveryFee)}</dd></div><div data-dyws-order-field="tax"><dt>Tax (${this.catalog.taxBasisPoints/100}%)</dt><dd>${this.amount(order.tax)}</dd></div></dl><div class="dyws-review-details"><p data-dyws-order-field="name">${escapeHTML(order.customer.name)} <button type="button" class="dyws-edit" data-edit="customer" aria-label="Edit name">Edit</button></p><p data-dyws-order-field="phone">${escapeHTML(formatPhone(order.customer.phone))} <button type="button" class="dyws-edit" data-edit="phone" aria-label="Edit phone">Edit</button></p><div data-dyws-order-field="address" hidden></div><span data-dyws-order-field="postal" hidden></span><p data-dyws-order-field="notes" ${order.notes?'':'hidden'}>${escapeHTML(order.notes)} <button type="button" class="dyws-edit" data-edit="notes" aria-label="Edit note">Edit</button></p></div><div data-dyws-order-field="total"><div class="dyws-review-fulfillment">${fulfillmentHTML(order)}<p>${escapeHTML(order.orderLocation?.name||this.catalog.businessName||'')}<br>${order.fulfillment==='delivery'?addressHTML(deliveryStreet)+(deliveryCity?'<br>'+escapeHTML(deliveryCity):''):pickupLink}</p><button type="button" class="dyws-edit" data-edit="${order.fulfillment==='delivery'?'addressLine1':order.fulfillmentMeta?.scheduled?'pickupDate':form.elements.locationId.options.length>1?'locationId':'fulfillment'}" aria-label="Edit pickup or delivery">Edit</button></div><p class="dyws-review-tip" ${order.tip?'':'hidden'}><span>Tip <button type="button" class="dyws-edit" data-edit="tipDollars" aria-label="Edit tip">Edit</button></span><strong>${this.amount(order.tip)}</strong></p><p class="dyws-grand-total">Total ${this.amount(order.total)}</p></div><p id="dyws-review-notice" class="dyws-review-notice" role="status" aria-live="polite" aria-atomic="true"></p><div class="dyws-review-footer"><div class="dyws-review-options"><label class="dyws-option-toggle"><input type="checkbox" name="autoSubmit"> Send after 10 seconds</label></div><div data-dyws-order-field="actions" class="dyws-actions"><button type="button" class="dyws-review-back dyws-muted">Back</button><button data-dyws-order-field="pause" type="button" class="dyws-review-pause dyws-muted" aria-label="Pause automatic submission" hidden>10 sec</button><button type="button" class="dyws-review-confirm" aria-label="Place order">Place order</button></div></div>`;
    const cancellation=locationPolicy(this.catalog,order.orderLocation).customerCancellation;
    if(cancellation?.enabled){const note=document.createElement('p');note.className='dyws-note dyws-cancellation-note';note.textContent=`Cancel within ${cancellation.minutes} ${cancellation.minutes===1?'minute':'minutes'} of placing your order, before pickup or dispatch.`;review.querySelector('.dyws-review-footer').prepend(note);}
    this.applyLayout('review',review);
    const confirm=review.querySelector('.dyws-review-confirm'),pause=review.querySelector('.dyws-review-pause'),notice=review.querySelector('.dyws-review-notice');
    confirm.before(pause);content.append(review);review.focus();
    const edit=name=>{
      this.checkoutDraft=captureCheckout(form);this.cancelReview();
      if(name==='items'){this.showCart();this.shadowRoot.querySelector('[data-change]')?.focus();return;}
      if(name==='notes'){form.querySelector('#dyws-note-field').hidden=false;form.querySelector('.dyws-note-add').hidden=true;}
      const field=name==='fulfillment'?form.querySelector('[name="fulfillment"]:checked'):form.elements.namedItem(name);
      field?.focus();
    };
    review.querySelectorAll('[data-edit]').forEach(button=>button.onclick=()=>edit(button.dataset.edit));
    review.querySelector('.dyws-review-back').onclick=()=>{this.cancelReview();form.querySelector('button[type="submit"]').focus();};
    confirm.onclick=()=>{void this.sendReviewedOrder({order,form,content,review});};
    pause.onclick=()=>this.reviewCountdown?.toggle();
    review.querySelector('[name="autoSubmit"]').onchange=event=>{
      this.reviewCountdown?.cancel();this.reviewCountdown=null;this.reviewVisibility?.disconnect();this.reviewVisibility=null;
      pause.hidden=!event.target.checked;notice.textContent='';
      if(!event.target.checked)return;
      pause.dataset.paused='false';pause.setAttribute('aria-label','Pause automatic submission');notice.textContent='Sends in 10 seconds.';
      this.reviewCountdown=createConfirmationCountdown({document:this.ownerDocument,onTick:seconds=>{pause.textContent=`${seconds} sec`;},onPause:()=>{
        notice.textContent='Paused. Place order when ready.';pause.textContent='Resume';pause.dataset.paused='true';pause.setAttribute('aria-label','Resume countdown');
      },onResume:()=>{pause.dataset.paused='false';pause.setAttribute('aria-label','Pause automatic submission');notice.textContent='Sends when the countdown ends.';},onConfirm:()=>{void this.sendReviewedOrder({order,form,content,review});}});
      if(typeof IntersectionObserver==='function'){this.reviewVisibility=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.intersectionRatio<.99))this.reviewCountdown?.pause();},{threshold:1});this.reviewVisibility.observe(confirm);}
    };

  }
export async function sendReviewedOrder({order,form,content,review}){
    if(this.busy||!this.dialog.open||!this.isConnected||this.reviewPanel!==review)return;
    this.reviewCountdown?.cancel();this.reviewCountdown=null;this.reviewVisibility?.disconnect();this.busy=true;this.shadowRoot.querySelector('.dyws-close').disabled=true;review.querySelectorAll('button,input').forEach(b=>b.disabled=true);
    review.querySelector('.dyws-review-notice').textContent='Sending…';
    try {
        if(typeof this.submitOrder!=='function') throw new Error('No checkout adapter is configured.');
        const result=await this.submitOrder(order);
        if(!result?.id)throw new Error('Order confirmation was not received.');
        this.pickup?.destroy();this.pickup=null;this.reviewPanel=null;this.checkoutDraft=null;this.lines=[];this.persist();
        content.innerHTML=`<h3>Order received</h3><p>Reference <strong>${escapeHTML(result.id)}</strong></p>${result.paymentProvider!=='demo'?'<p>Continue to payment below.</p>':''}<button type="button" class="dyws-done">Back to menu</button>`;
        content.querySelector('.dyws-done').onclick=()=>{this.dialog.close();this.dispatchEvent(new CustomEvent('order-confirmation-closed',{bubbles:true}));};
        this.dispatchEvent(new CustomEvent('order-complete',{detail:{id:result.id,demo:result.demo===true,trackingToken:result.trackingToken},bubbles:true}));
      }catch(error){this.cancelReview();form.querySelector('.dyws-error').textContent=error.message||'Unable to submit. Your cart has been kept.';form.querySelector('button[type="submit"]').focus();}
      finally{this.busy=false;this.shadowRoot.querySelector('.dyws-close').disabled=false;}
  }