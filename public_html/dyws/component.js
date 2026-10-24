import {readCatalog} from './catalog-data.js';
import {lineKey,resolveItem,restoreCart,totals} from './cart.js';
const escapeHTML = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export class DYWSOrdering extends HTMLElement {
  constructor(){super();this.attachShadow({mode:'open'});this.lines=[];this.busy=false;}
  async connectedCallback(){
    this.shadowRoot.innerHTML='<p role="status">Loading ordering…</p>';
    try {
      this.catalog=await readCatalog(this);
      if(!Array.isArray(this.catalog.categories)) throw new Error('Catalog unavailable');
      this.money=new Intl.NumberFormat('en-CA',{style:'currency',currency:this.catalog.currency});
      try {this.lines=restoreCart(this.catalog,JSON.parse(localStorage.getItem(this.key)||'[]'));}catch{}
      this.render();this.dispatchEvent(new CustomEvent('ordering-ready',{bubbles:true}));
    } catch {this.shadowRoot.innerHTML='<p role="alert">Ordering is unavailable. Please try again later.</p>';}
  }
  get key(){return this.getAttribute('storage-key')||'dyws-cart';}
  amount(value){return this.money.format(value/100);}
  persist(){try{localStorage.setItem(this.key,JSON.stringify(this.lines));}catch{} this.updateButton();this.dispatchEvent(new CustomEvent('cart-change',{detail:{count:this.lines.reduce((n,l)=>n+l.quantity,0)},bubbles:true}));void this.plugins?.runAction('cart:updated',{lines:this.lines.map(line=>({...line})),totals:totals(this.lines,this.catalog.taxBasisPoints)});}
  updateButton(){const count=this.lines.reduce((n,l)=>n+l.quantity,0);this.shadowRoot.querySelector('.dyws-cart-launch').textContent=`Your order (${count}) · ${this.amount(totals(this.lines,this.catalog.taxBasisPoints).total)}`;}
  add(id,variant=''){
    if(!this.catalog || this.busy)return;
    const item=resolveItem(this.catalog,id,variant);const key=lineKey(id,variant);
    const row=this.lines.find(l=>lineKey(l.id,l.variant)===key);
    if(row){if(row.quantity>=99){this.announce('Maximum quantity is 99.');return;}row.quantity++;}else this.lines.push({...item,quantity:1});
    this.persist();this.announce(`${item.name} added to your order.`);
  }
  remove(id,variant=''){
    if(!this.catalog || this.busy)return;
    const row=this.lines.find(line=>lineKey(line.id,line.variant)===lineKey(id,variant));
    if(!row)return;
    row.quantity--;
    this.lines=this.lines.filter(line=>line.quantity>0);
    this.persist();this.announce(`${row.name} quantity ${row.quantity}.`);
  }
  announce(text){this.shadowRoot.querySelector('[role="status"]').textContent=text;}
  render(){
    this.shadowRoot.innerHTML=`<link rel="stylesheet" href="${new URL('./ordering.css?v=41',import.meta.url).href}"><div class="dyws-ordering"><button class="dyws-cart-launch" type="button">Your order</button><p id="dyws-status" role="status" aria-live="polite"></p><dialog aria-labelledby="dyws-order-title"><header><h2 id="dyws-order-title">Your order</h2><small>${escapeHTML(this.catalog.platformName || 'DYWS')}</small><button type="button" class="dyws-muted dyws-close" aria-label="Close order">Close</button></header><div class="dyws-content"></div></dialog></div>`;
    this.dialog=this.shadowRoot.querySelector('dialog');
    this.shadowRoot.querySelector('.dyws-cart-launch').onclick=()=>this.open();
    this.shadowRoot.querySelector('.dyws-close').onclick=()=>this.dialog.close();
    this.dialog.addEventListener('cancel',e=>{if(this.busy)e.preventDefault();});
    this.updateButton();
  }
  open(){this.showCart();this.dialog.showModal();}
  showCart(){
    const content=this.shadowRoot.querySelector('.dyws-content');const t=totals(this.lines,this.catalog.taxBasisPoints);
    content.innerHTML=this.lines.length?this.lines.map((l,n)=>`<div class="dyws-line"><strong>${escapeHTML(l.name)}</strong>${escapeHTML(l.option)} <span>${this.amount(l.price*l.quantity)}</span><div class="dyws-quantity"><button data-change="${n}" data-delta="-1" aria-label="Remove one ${escapeHTML(l.name)}">−</button><span aria-label="Quantity">${l.quantity}</span><button data-change="${n}" data-delta="1" aria-label="Add one ${escapeHTML(l.name)}" ${l.quantity>=99?'disabled':''}>+</button><button class="dyws-muted dyws-remove" data-remove="${n}" aria-label="Remove ${escapeHTML(l.name)}" title="Remove ${escapeHTML(l.name)}"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6"/></svg></button></div></div>`).join('')+`<dl class="dyws-summary"><dt>Subtotal</dt><dd>${this.amount(t.subtotal)}</dd><dt>Tax (${this.catalog.taxBasisPoints/100}%)</dt><dd>${this.amount(t.tax)}</dd><dt>Total</dt><dd>${this.amount(t.total)}</dd></dl><p class="dyws-note">Choose pickup or delivery at checkout.</p><button class="dyws-checkout" type="button">Continue to checkout</button>`:'<p>Your order is empty. Add something from the catalog.</p>';
    content.querySelectorAll('[data-change]').forEach(b=>b.onclick=()=>{const n=Number(b.dataset.change);this.lines[n].quantity+=Number(b.dataset.delta);this.lines=this.lines.filter(l=>l.quantity>0);this.persist();this.showCart();});
    content.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{this.lines.splice(Number(b.dataset.remove),1);this.persist();this.showCart();});
    content.querySelector('.dyws-checkout')?.addEventListener('click',()=>this.checkout());
  }
  async checkout(){
    const t=totals(this.lines,this.catalog.taxBasisPoints);const content=this.shadowRoot.querySelector('.dyws-content');
    content.innerHTML=`<form><div class="dyws-checkout-grid"><label>Name<input name="customer" required maxlength="100" autocomplete="off"></label><label>Phone number<input name="phone" type="tel" required pattern="[0-9+() .-]{7,30}" maxlength="30" autocomplete="off"></label></div><fieldset class="dyws-fulfillment"><legend>Order type</legend><div class="dyws-pillbox"><label><input type="radio" name="fulfillment" value="pickup" aria-label="Pickup" checked><span>Pickup</span></label><label><input type="radio" name="fulfillment" value="delivery" aria-label="Delivery" aria-describedby="dyws-delivery-fee"><span>Delivery</span></label></div><p class="dyws-note" id="dyws-delivery-fee">Delivery fee: ${this.amount(this.catalog.deliveryFee ?? 395)}.</p></fieldset><fieldset class="dyws-delivery-address" hidden disabled><legend>Delivery address</legend><div class="dyws-checkout-grid"><label>Street address<input name="addressLine1" required maxlength="120" autocomplete="address-line1"></label><label>Unit or apartment, optional<input name="addressLine2" maxlength="60" autocomplete="address-line2"></label><label>City<input name="addressCity" required maxlength="80" autocomplete="address-level2" value="Edmonton"></label><label>Province or state<input name="addressRegion" required maxlength="60" autocomplete="address-level1" value="AB"></label><label>Postal or ZIP code<input name="addressPostal" required maxlength="20" autocomplete="postal-code"></label><label>Country<input name="addressCountry" required maxlength="60" autocomplete="country-name" value="Canada"></label></div></fieldset><label>Order notes, optional<textarea name="notes" maxlength="500"></textarea></label><p class="dyws-pickup-location">Pickup at <a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(this.catalog.pickupAddress || this.catalog.businessName || this.catalog.restaurant)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHTML(this.catalog.pickupAddress || this.catalog.businessName || this.catalog.restaurant)}, Google Maps, opens in a new tab">${escapeHTML(this.catalog.pickupAddress || this.catalog.businessName || this.catalog.restaurant)} ↗</a></p><p><strong class="dyws-checkout-total">Total ${this.amount(t.total)}</strong></p><div data-dyws-checkout-fields></div><p role="alert" class="dyws-error"></p><div class="dyws-actions"><button type="submit">Place order</button><button type="button" class="dyws-muted dyws-back">Back to cart</button></div></form>`;
    content.querySelector('.dyws-back').onclick=()=>this.showCart();
    const form=content.querySelector('form');
    const pluginData={};let fieldsReady=!this.plugins;
    form.querySelector('.dyws-fulfillment').onchange=()=>{const delivery=form.elements.fulfillment.value==='delivery';form.querySelector('.dyws-delivery-address').hidden=!delivery;form.querySelector('.dyws-delivery-address').disabled=!delivery;form.querySelector('.dyws-pickup-location').hidden=delivery;const fee=delivery?(this.catalog.deliveryFee ?? 395):0;const total=t.subtotal+fee+Math.round((t.subtotal+fee)*this.catalog.taxBasisPoints/10000);form.querySelector('.dyws-checkout-total').textContent='Total '+this.amount(total);};
    form.onsubmit=async event=>{
      event.preventDefault();if(this.busy||!fieldsReady||!form.reportValidity())return;
      const values=new FormData(form);if(!values.get('customer').trim()){content.querySelector('.dyws-error').textContent='Enter a name.';return;}
      this.busy=true;this.shadowRoot.querySelector('.dyws-close').disabled=true;form.querySelectorAll('button').forEach(b=>b.disabled=true);
      const addressDetails=values.get('fulfillment')==='delivery'?Object.fromEntries([['line1','addressLine1'],['line2','addressLine2'],['city','addressCity'],['region','addressRegion'],['postalCode','addressPostal'],['country','addressCountry']].map(([key,field])=>[key,String(values.get(field)||'').trim()])):undefined;
      const order={businessName:this.catalog.businessName || this.catalog.restaurant,currency:this.catalog.currency,lines:this.lines.map(l=>({...l})),...t,customer:{name:values.get('customer').trim(),phone:values.get('phone').trim()},notes:values.get('notes').trim(),fulfillment:values.get('fulfillment'),pluginData,addressDetails,address:addressDetails?[addressDetails.line1,addressDetails.line2,addressDetails.city,addressDetails.region,addressDetails.postalCode,addressDetails.country].filter(Boolean).join(', '):''};
      try {
      await this.plugins?.validate('checkout:validating',{form,order,pluginData});
      const fingerprint=JSON.stringify(order);if(this.pendingFingerprint!==fingerprint){this.pendingFingerprint=fingerprint;this.pendingKey=crypto.randomUUID();}order.idempotencyKey=this.pendingKey;const fee=order.fulfillment==='delivery'?(this.catalog.deliveryFee ?? 395):0;order.total=t.subtotal+fee+Math.round((t.subtotal+fee)*this.catalog.taxBasisPoints/10000);
        if(typeof this.submitOrder!=='function') throw new Error('No checkout adapter is configured.');
        const result=await this.submitOrder(order);
        if(!result?.id)throw new Error('Order confirmation was not received.');
        this.lines=[];this.persist();
        content.innerHTML=`<h3>Order received</h3><p>Reference <strong>${escapeHTML(result.id)}</strong></p><p>Your order is saved. ${result.paymentProvider!=='demo'?'Continue to payment in the tracking panel on this page.':'Follow its status on this page.'}</p><button type="button" class="dyws-done">Back to items</button>`;
        content.querySelector('.dyws-done').onclick=()=>{this.dialog.close();this.dispatchEvent(new CustomEvent('order-confirmation-closed',{bubbles:true}));};
        this.dispatchEvent(new CustomEvent('order-complete',{detail:{id:result.id,demo:result.demo===true,trackingToken:result.trackingToken},bubbles:true}));
      }catch(error){content.querySelector('.dyws-error').textContent=error.message||'Unable to submit. Your cart has been kept.';form.querySelectorAll('button').forEach(b=>b.disabled=false);}
      finally{this.busy=false;this.shadowRoot.querySelector('.dyws-close').disabled=false;}
    };
    if(this.plugins){
     const buttons=[...form.querySelectorAll('button')];buttons.forEach(button=>button.disabled=true);
     await this.plugins.runAction('checkout:fields',{root:form.querySelector('[data-dyws-checkout-fields]'),form,pluginData});
     buttons.forEach(button=>button.disabled=false);
    }
    fieldsReady=true;form.querySelector('input').focus();
  }
}
customElements.define('dyws-ordering',DYWSOrdering);
