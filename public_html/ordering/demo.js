import './component.js?v=19';
import {api} from '../platform/api.js';
import {showTracking} from '../platform/tracking.js?v=19';
const ordering=document.querySelector('dyws-ordering,starlit-ordering,restaurant-ordering');
ordering.submitOrder=async order=>api('/orders',{method:'POST',body:{...order,demoAcknowledged:true}});
ordering.addEventListener('order-confirmation-closed',()=>document.querySelector('#customer-tracking')?.scrollIntoView({behavior:'smooth',block:'start'}));
ordering.addEventListener('order-complete',event=>{if(event.detail.trackingToken)showTracking(event.detail.id,event.detail.trackingToken);});
function updateItemCounts(){
 for(const controls of document.querySelectorAll('[data-order-item]')){
  const variant=controls.closest('.dyws-product').querySelector('select')?.value||'';
  const count=ordering.lines.find(line=>line.id===controls.dataset.orderItem && line.variant===variant)?.quantity||0;
  const add=controls.querySelector('.dyws-item-add');
  const stepper=controls.querySelector('.dyws-item-stepper');
  const minus=controls.querySelector('.dyws-item-minus');
  const plus=controls.querySelector('.dyws-item-plus');
  const focused=document.activeElement;
  add.hidden=count>0;stepper.hidden=count===0;
  controls.querySelector('output').textContent=count;
  plus.disabled=count>=99;
  if(count===0 && (focused===minus||focused===plus))add.focus();
  else if(count>0 && focused===add)plus.focus();
 }
}
ordering.addEventListener('cart-change',updateItemCounts);
const money=value=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(value/100);
ordering.addEventListener('ordering-ready',()=>{
 const menu=document.querySelector('#menu');
 const nav=document.querySelector('nav[aria-label="Menu categories"]');nav.replaceChildren();
 for(const category of ordering.catalog.categories){
  const link=document.createElement('a');link.href='#'+category.id;link.textContent=category.name;nav.append(link);
  const section=document.createElement('section');section.id=category.id;section.className='dyws-category';
  const heading=document.createElement('h2');heading.textContent=category.name;section.append(heading);
  const layout=document.createElement('div');layout.className='dyws-category-layout';
  if(category.image){const photo=document.createElement('img');photo.className='dyws-category-photo';photo.src=category.image.src;photo.alt=category.image.alt;photo.width=1200;photo.height=800;photo.loading='lazy';photo.decoding='async';layout.append(photo);}
  const dishes=document.createElement('div');dishes.className='dyws-products';layout.append(dishes);section.append(layout);
  for(const item of category.items){
   if(item.active===false)continue;
   const row=document.createElement('article');row.className='dyws-product';
   const info=document.createElement('div');const title=document.createElement('h3');title.textContent=item.name;const description=document.createElement('p');description.textContent=item.description;info.append(title,description);
   if(item.image&&!category.image){const image=document.createElement('img');image.className='dyws-product-image';image.src=item.image.src;image.alt=item.image.alt;image.loading='lazy';info.prepend(image);}
   let select;
   if(item.variants){const label=document.createElement('label');label.textContent=(item.optionLabel||'Option')+' ';select=document.createElement('select');select.setAttribute('aria-label',item.name+' option');for(const variant of item.variants){const option=document.createElement('option');option.value=variant.id;option.textContent=variant.name;select.append(option);}label.append(select);info.append(label);}
   const action=document.createElement('div');action.className='dyws-product-action';
   const price=document.createElement('span');price.textContent=money(item.price);
   const controls=document.createElement('div');controls.className='dyws-item-controls';controls.dataset.orderItem=item.id;
   const add=document.createElement('button');add.type='button';add.className='dyws-item-add';add.textContent='Add';add.setAttribute('aria-label','Add '+item.name);add.onclick=()=>ordering.add(item.id,select?.value||'');
   const stepper=document.createElement('div');stepper.className='dyws-item-stepper';stepper.hidden=true;stepper.setAttribute('role','group');stepper.setAttribute('aria-label',item.name+' quantity');
   const minus=document.createElement('button');minus.type='button';minus.className='dyws-item-minus';minus.textContent='−';minus.setAttribute('aria-label','Remove one '+item.name);minus.onclick=()=>ordering.remove(item.id,select?.value||'');
   const quantity=document.createElement('output');quantity.setAttribute('aria-label',item.name+' quantity');quantity.setAttribute('aria-live','polite');quantity.textContent='0';
   const plus=document.createElement('button');plus.type='button';plus.className='dyws-item-plus';plus.textContent='+';plus.setAttribute('aria-label','Add one '+item.name);plus.onclick=()=>ordering.add(item.id,select?.value||'');
   stepper.append(minus,quantity,plus);controls.append(add,stepper);action.append(price,controls);row.append(info,action);dishes.append(row);
   if(select)select.addEventListener('change',()=>{price.textContent=money(item.variants.find(v=>v.id===select.value).price);updateItemCounts();});
  }
  menu.append(section);
 }
 document.querySelector('#loading').remove();
 updateItemCounts();
});
