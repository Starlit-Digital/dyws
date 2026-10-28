import {readCatalog} from './catalog-data.js';
import {lineKey,resolveItem,restoreCart,totals,itemOrderCap,itemQuantity} from './cart.js?v=options-20261028';
import {applyOrderLayout} from './order-layout.js';
import {captureCheckout} from './checkout-draft.js?v=benefits-20261028';
import {mountCheckout} from './checkout.js?v=benefits-20261028';
import {showOrderReview,sendReviewedOrder} from './order-review.js?v=benefits-20261028';
const escapeHTML = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatPhone = value => {const phone=String(value??'');const digits=phone.replace(/\D/g,'').replace(/^1(?=\d{10}$)/,'');return digits.length===10?`(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`:phone;};
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
  disconnectedCallback(){this.checkoutDeals?.destroy();this.cancelReview();this.pickup?.destroy();this.checkoutAccount?.destroy();}
  cancelReview(){this.reviewCountdown?.cancel();this.reviewCountdown=null;this.reviewVisibility?.disconnect();this.reviewVisibility=null;this.reviewPanel?.remove();this.reviewPanel=null;const form=this.shadowRoot.querySelector('form');if(form)form.hidden=false;}
  applyLayout(stage,root){return applyOrderLayout({stage,root,layout:this.plugins?.orderLayout?.(stage)});}
  amount(value){return this.money.format(value/100);}
  persist(){try{localStorage.setItem(this.key,JSON.stringify(this.lines));}catch{} this.updateButton();this.dispatchEvent(new CustomEvent('cart-change',{detail:{count:this.lines.reduce((n,l)=>n+l.quantity,0)},bubbles:true}));void this.plugins?.runAction('cart:updated',{lines:this.lines.map(line=>({...line})),totals:totals(this.lines,this.catalog.taxBasisPoints)});}
  updateButton(){const count=this.lines.reduce((n,l)=>n+l.quantity,0);this.shadowRoot.querySelector('.dyws-cart-launch').textContent=`Your order (${count}) · ${this.amount(totals(this.lines,this.catalog.taxBasisPoints).total)}`;}
  add(id,variant='',selections={}){
    if(!this.catalog || this.busy||this.reviewPanel)return;
    const item=resolveItem(this.catalog,id,variant,selections);const key=lineKey(id,variant,selections);
    const row=this.lines.find(l=>lineKey(l.id,l.variant,l.selections)===key);
    if(itemQuantity(this.lines,id)>=itemOrderCap(this.catalog)){this.showItemLimit();return;}
    if(row)row.quantity++;else this.lines.push({...item,quantity:1});
    this.persist();this.announce(`${item.name} added to your order.`);
  }
  remove(id,variant='',selections={}){
    if(!this.catalog || this.busy||this.reviewPanel)return;
    const row=this.lines.find(line=>lineKey(line.id,line.variant,line.selections)===lineKey(id,variant,selections));
    if(!row)return;
    row.quantity--;
    this.lines=this.lines.filter(line=>line.quantity>0);
    this.persist();this.announce(`${row.name} quantity ${row.quantity}.`);
  }
  announce(text){this.shadowRoot.querySelector('[role="status"]').textContent=text;}
  render(){
    this.shadowRoot.innerHTML=`<link rel="stylesheet" href="${new URL('./ordering.css?v=benefits-20261028',import.meta.url).href}"><div class="dyws-ordering"><button class="dyws-cart-launch" type="button">Your order</button><p id="dyws-status" role="status" aria-live="polite"></p><dialog aria-label="Your order"><header role="presentation"><div class="dyws-store-brand"><slot name="site-logo"></slot><span>${escapeHTML(this.catalog.businessName || this.catalog.restaurant || '')}</span></div><button type="button" class="dyws-muted dyws-close" aria-label="Close order">Close</button></header><div class="dyws-content"></div></dialog></div>`;
    this.dialog=this.shadowRoot.querySelector('dialog');
    this.shadowRoot.querySelector('.dyws-cart-launch').onclick=()=>this.open();
    this.shadowRoot.querySelector('.dyws-close').onclick=()=>this.dialog.close();
    this.dialog.addEventListener('cancel',e=>{if(this.busy)e.preventDefault();});
    this.dialog.addEventListener('close',()=>{const form=this.shadowRoot.querySelector('form');if(form)this.checkoutDraft=captureCheckout(form);this.cancelReview();this.pickup?.destroy();this.checkoutAccount?.destroy();});
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
    this.checkoutDeals?.destroy();this.checkoutDeals=null;
    this.pickup?.destroy();this.checkoutAccount?.destroy();this.pickup=null;this.cancelReview();
    const content=this.shadowRoot.querySelector('.dyws-content');const t=totals(this.lines,this.catalog.taxBasisPoints);
    content.innerHTML=this.lines.length?'<div data-dyws-order-field="items">'+this.lines.map((l,n)=>`<div class="dyws-line"><div class="dyws-line-info"><strong>${escapeHTML(l.name)}</strong>${escapeHTML(l.option)} <span>${this.amount(l.price*l.quantity)}</span></div><div class="dyws-quantity"><button data-change="${n}" data-delta="-1" aria-label="${l.quantity===1?'Remove':'Remove one'} ${escapeHTML(l.name)}">${l.quantity===1?'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6"/></svg>':'−'}</button><span aria-label="Quantity">${l.quantity}</span><button data-change="${n}" data-delta="1" aria-label="Add one ${escapeHTML(l.name)}">+</button></div></div>`).join('')+`</div><div class="dyws-summary-panel"><dl class="dyws-summary"><div class="dyws-order-pair" data-dyws-order-field="subtotal"><dt>Subtotal</dt><dd>${this.amount(t.subtotal)}</dd></div><div class="dyws-order-pair" data-dyws-order-field="tax"><dt>Tax (${this.catalog.taxBasisPoints/100}%)</dt><dd>${this.amount(t.tax)}</dd></div></dl><p class="dyws-grand-total" data-dyws-order-field="total">Total ${this.amount(t.total)}</p></div><button data-dyws-order-field="actions" class="dyws-checkout" type="button">Checkout</button>`:'<p>Your cart is empty.</p>';
    if(this.lines.length)this.applyLayout('cart',content);
    content.querySelectorAll('[data-change]').forEach(b=>b.onclick=()=>{const n=Number(b.dataset.change);if(Number(b.dataset.delta)>0&&itemQuantity(this.lines,this.lines[n].id)>=itemOrderCap(this.catalog)){this.showItemLimit();return;}this.lines[n].quantity+=Number(b.dataset.delta);this.lines=this.lines.filter(l=>l.quantity>0);this.persist();this.showCart();});
    content.querySelector('.dyws-checkout')?.addEventListener('click',()=>this.checkout());
  }
  checkout(){return mountCheckout.call(this);}
  reviewOrder(args){return showOrderReview.call(this,args);}
  sendReviewedOrder(args){return sendReviewedOrder.call(this,args);}

}
customElements.define('dyws-ordering',DYWSOrdering);
