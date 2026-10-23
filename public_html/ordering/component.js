import {lineKey,resolveItem,restoreCart,totals} from './cart.js';
const escapeHTML = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export class RestaurantOrdering extends HTMLElement {
  constructor(){super();this.attachShadow({mode:'open'});this.lines=[];this.busy=false;}
  async connectedCallback(){
    this.shadowRoot.innerHTML='<p role="status">Loading ordering…</p>';
    try {
      const response=await fetch(this.getAttribute('catalog'));
      if(!response.ok) throw new Error('Menu unavailable');
      this.catalog=await response.json();
      if(!Array.isArray(this.catalog.categories)) throw new Error('Menu unavailable');
      this.money=new Intl.NumberFormat('en-CA',{style:'currency',currency:this.catalog.currency});
      try {this.lines=restoreCart(this.catalog,JSON.parse(localStorage.getItem(this.key)||'[]'));}catch{}
      this.render();this.dispatchEvent(new CustomEvent('ordering-ready',{bubbles:true}));
    } catch {this.shadowRoot.innerHTML='<p role="alert">Ordering is unavailable. Please try again later.</p>';}
  }
  get key(){return this.getAttribute('storage-key')||'starlit-order-cart';}
  amount(value){return this.money.format(value/100);}
  persist(){try{localStorage.setItem(this.key,JSON.stringify(this.lines));}catch{} this.updateButton();this.dispatchEvent(new CustomEvent('cart-change',{detail:{count:this.lines.reduce((n,l)=>n+l.quantity,0)},bubbles:true}));}
  updateButton(){const count=this.lines.reduce((n,l)=>n+l.quantity,0);this.shadowRoot.querySelector('.cart-launch').textContent=`Your order (${count}) · ${this.amount(totals(this.lines,this.catalog.taxBasisPoints).total)}`;}
  add(id,variant=''){
    if(!this.catalog || this.busy)return;
    const item=resolveItem(this.catalog,id,variant);const key=lineKey(id,variant);
    const row=this.lines.find(l=>lineKey(l.id,l.variant)===key);
    if(row){if(row.quantity>=99){this.announce('Maximum quantity is 99.');return;}row.quantity++;}else this.lines.push({...item,quantity:1});
    this.persist();this.announce(`${item.name} added to your order.`);
  }
  announce(text){this.shadowRoot.querySelector('[role="status"]').textContent=text;}
  render(){
    this.shadowRoot.innerHTML=`<link rel="stylesheet" href="${new URL('./component.css',import.meta.url).href}"><button class="cart-launch" type="button">Your order</button><p id="status" role="status" aria-live="polite"></p><dialog aria-labelledby="order-title"><header><h2 id="order-title">Your order</h2><button type="button" class="muted close" aria-label="Close order">Close</button></header><div class="content"></div></dialog>`;
    this.dialog=this.shadowRoot.querySelector('dialog');
    this.shadowRoot.querySelector('.cart-launch').onclick=()=>this.open();
    this.shadowRoot.querySelector('.close').onclick=()=>this.dialog.close();
    this.dialog.addEventListener('cancel',e=>{if(this.busy)e.preventDefault();});
    this.updateButton();
  }
  open(){this.showCart();this.dialog.showModal();}
  showCart(){
    const content=this.shadowRoot.querySelector('.content');const t=totals(this.lines,this.catalog.taxBasisPoints);
    content.innerHTML=this.lines.length?this.lines.map((l,n)=>`<div class="line"><strong>${escapeHTML(l.name)}</strong>${escapeHTML(l.option)} <span>${this.amount(l.price*l.quantity)}</span><div class="quantity"><button data-change="${n}" data-delta="-1" aria-label="Remove one ${escapeHTML(l.name)}">−</button><span aria-label="Quantity">${l.quantity}</span><button data-change="${n}" data-delta="1" aria-label="Add one ${escapeHTML(l.name)}" ${l.quantity>=99?'disabled':''}>+</button><button class="muted" data-remove="${n}" aria-label="Remove ${escapeHTML(l.name)}">Remove</button></div></div>`).join('')+`<dl class="summary"><dt>Subtotal</dt><dd>${this.amount(t.subtotal)}</dd><dt>Tax (${this.catalog.taxBasisPoints/100}%)</dt><dd>${this.amount(t.tax)}</dd><dt>Total</dt><dd>${this.amount(t.total)}</dd></dl><p class="note">Pickup only. Demonstration checkout, no real order or payment.</p><button class="checkout" type="button">Continue to checkout</button>`:'<p>Your order is empty. Add something from the menu.</p>';
    content.querySelectorAll('[data-change]').forEach(b=>b.onclick=()=>{const n=Number(b.dataset.change);this.lines[n].quantity+=Number(b.dataset.delta);this.lines=this.lines.filter(l=>l.quantity>0);this.persist();this.showCart();});
    content.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{this.lines.splice(Number(b.dataset.remove),1);this.persist();this.showCart();});
    content.querySelector('.checkout')?.addEventListener('click',()=>this.checkout());
  }
  checkout(){
    const t=totals(this.lines,this.catalog.taxBasisPoints);const content=this.shadowRoot.querySelector('.content');
    content.innerHTML=`<h3>Pickup details</h3><p class="note">Use fictional details for this test. Nothing is sent to a restaurant.</p><form><label>Name<input name="customer" required maxlength="100" autocomplete="off"></label><label>Phone<input name="phone" type="tel" required pattern="[0-9+() .-]{7,30}" maxlength="30" autocomplete="off"></label><label>Order notes, optional<textarea name="notes" maxlength="500"></textarea></label><p>Pickup at ${escapeHTML(this.catalog.pickupAddress || this.catalog.restaurant)}</p><p><strong>Total ${this.amount(t.total)}</strong></p><label><input type="checkbox" required> I understand this is a test order.</label><p role="alert" class="error"></p><div class="actions"><button type="submit">Place test order</button><button type="button" class="muted back">Back to cart</button></div></form>`;
    content.querySelector('.back').onclick=()=>this.showCart();
    const form=content.querySelector('form');form.onsubmit=async event=>{
      event.preventDefault();if(this.busy||!form.reportValidity())return;
      const values=new FormData(form);if(!values.get('customer').trim()){content.querySelector('.error').textContent='Enter a name.';return;}
      this.busy=true;this.shadowRoot.querySelector('.close').disabled=true;form.querySelectorAll('button').forEach(b=>b.disabled=true);
      const order={restaurant:this.catalog.restaurant,currency:this.catalog.currency,lines:this.lines.map(l=>({...l})),...t,customer:{name:values.get('customer').trim(),phone:values.get('phone').trim()},notes:values.get('notes').trim(),fulfillment:'pickup',idempotencyKey:crypto.randomUUID()};
      try {
        if(typeof this.submitOrder!=='function') throw new Error('No checkout adapter is configured.');
        const result=await this.submitOrder(order);
        if(!result?.id)throw new Error('Order confirmation was not received.');
        this.lines=[];this.persist();
        content.innerHTML=`<h3>Test order complete</h3><p>Reference <strong>${escapeHTML(result.id)}</strong></p><p>No real order was sent. No payment was collected.</p><button type="button" class="done">Back to menu</button>`;
        content.querySelector('.done').onclick=()=>this.dialog.close();
        this.dispatchEvent(new CustomEvent('order-complete',{detail:{id:result.id,demo:result.demo===true},bubbles:true}));
      }catch(error){content.querySelector('.error').textContent=error.message||'Unable to submit. Your cart has been kept.';form.querySelectorAll('button').forEach(b=>b.disabled=false);}
      finally{this.busy=false;this.shadowRoot.querySelector('.close').disabled=false;}
    };form.querySelector('input').focus();
  }
}
customElements.define('restaurant-ordering',RestaurantOrdering);
