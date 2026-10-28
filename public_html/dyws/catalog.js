import {lineKey,resolveItem} from './cart.js?v=options-20261028';
import {pluginSlot} from './plugin-ui.js?v=39';
export function mountCatalog({ordering,container,navigation,loading,locale='en-CA',hydrate=false,plugins}) {
 if(!ordering||!container)throw new TypeError('DYWS requires ordering and catalog elements.');
 container.classList.add('dyws-catalog');
const selectionsFor=row=>{const result={};for(const input of row.querySelectorAll('[data-choice-group]:checked'))(result[input.dataset.choiceGroup]??=[]).push(input.value);return result;};
function configureOptions(){
 for(const controls of container.querySelectorAll('[data-order-item]')){
  const row=controls.closest('.dyws-product'),item=ordering.catalog.categories.flatMap(c=>c.items).find(i=>i.id===controls.dataset.orderItem);
  if(!item?.optionGroups?.length||row.querySelector('.dyws-customize'))continue;
  const details=document.createElement('details');details.className='dyws-customize';
  const summary=document.createElement('summary');summary.textContent='Customize '+item.name;const summaryPrice=document.createElement('span');summaryPrice.className='dyws-customize-price';summary.append(summaryPrice);details.append(summary);
  const variantLabel=row.querySelector('select')?.closest('label');if(variantLabel)details.append(variantLabel);
  for(const group of item.optionGroups){
   const fieldset=document.createElement('fieldset'),legend=document.createElement('legend');
   const rule=group.min===group.max?`Choose exactly ${group.max}`:group.min===0?`Choose up to ${group.max}`:`Choose ${group.min} to ${group.max}`;
   legend.textContent=group.name+' · '+rule;fieldset.append(legend);
   for(const choice of group.choices){
    const label=document.createElement('label'),input=document.createElement('input');input.type=group.max===1?'radio':'checkbox';input.name=item.id+'_'+group.id;input.dataset.choiceGroup=group.id;input.value=choice.id;
    label.append(input,document.createTextNode(choice.name+(choice.price?' +'+money(choice.price):'')));fieldset.append(label);
   }
   if(group.min===0&&group.max===1){const label=document.createElement('label'),input=document.createElement('input');input.type='radio';input.name=item.id+'_'+group.id;input.checked=true;label.append(input,document.createTextNode('None'));fieldset.append(label);}
   details.append(fieldset);
  }
  const status=document.createElement('p');status.className='dyws-choice-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');details.append(status,row.querySelector('.dyws-product-action'));row.append(details);
 }
}
function updateItemCounts(){
 for(const controls of container.querySelectorAll('[data-order-item]')){
  const variant=controls.closest('.dyws-product').querySelector('select')?.value||'';
  const row=controls.closest('.dyws-product'),selections=selectionsFor(row);
  const count=ordering.lines.find(line=>lineKey(line.id,line.variant,line.selections)===lineKey(controls.dataset.orderItem,variant,selections))?.quantity||0;
  const add=controls.querySelector('.dyws-item-add');
  const stepper=controls.querySelector('.dyws-item-stepper');
  const minus=controls.querySelector('.dyws-item-minus');
  const plus=controls.querySelector('.dyws-item-plus');
  const focused=document.activeElement;
  add.disabled=false;add.hidden=count>0;stepper.hidden=count===0;
  controls.querySelector('output').textContent=count;
  plus.disabled=false;
  const status=row.querySelector('.dyws-choice-status');
  if(status){
   const item=ordering.catalog.categories.flatMap(c=>c.items).find(i=>i.id===controls.dataset.orderItem);
   let surcharge=0;
   for(const g of item.optionGroups){const ids=selections[g.id]||[];for(const c of g.choices)if(ids.includes(c.id))surcharge+=c.price;for(const input of row.querySelectorAll('[data-choice-group]'))if(input.dataset.choiceGroup===g.id&&input.type==='checkbox')input.disabled=!input.checked&&ids.length>=g.max;}
   const total=money((item.variants?.find(v=>v.id===variant)?.price??item.price)+surcharge);row.querySelector('.dyws-product-action > span').textContent=total;row.querySelector('.dyws-customize-price').textContent=' · '+total;
   try{resolveItem(ordering.catalog,item.id,variant,selections);status.textContent='';}catch(error){status.textContent=error.message;add.disabled=true;plus.disabled=true;}
  }
  if(count===0 && (focused===minus||focused===plus))add.focus();
  else if(count>0 && focused===add)plus.focus();
 }
}
ordering.addEventListener('cart-change',updateItemCounts);
const money=value=>new Intl.NumberFormat(locale,{style:'currency',currency:ordering.catalog.currency}).format(value/100);
function decorate(){
 if(!plugins)return;
 for(const controls of container.querySelectorAll('[data-order-item]')){
  const item=ordering.catalog.categories.flatMap(category=>category.items).find(item=>item.id===controls.dataset.orderItem);
  if(item)void plugins.runAction('catalog:item',{root:pluginSlot(controls.closest('.dyws-product'),'product'),item});
 }
}
function render(){
 if(hydrate&&container.hasAttribute('data-dyws-rendered')){configureOptions();updatePrices();updateItemCounts();loading?.remove();decorate();return;}
 const menu=container;menu.replaceChildren();
 navigation?.replaceChildren();
 for(const category of ordering.catalog.categories){
  if(navigation){const link=document.createElement('a');link.href='#'+category.id;link.textContent=category.name;navigation.append(link);}
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
   const price=document.createElement('span');price.textContent=money(select?item.variants.find(v=>v.id===select.value).price:item.price);
   const controls=document.createElement('div');controls.className='dyws-item-controls';controls.dataset.orderItem=item.id;
   const add=document.createElement('button');add.type='button';add.className='dyws-item-add';add.textContent='Add';add.setAttribute('aria-label','Add '+item.name);add.dataset.dywsAction='add';
   const stepper=document.createElement('div');stepper.className='dyws-item-stepper';stepper.hidden=true;stepper.setAttribute('role','group');stepper.setAttribute('aria-label',item.name+' quantity');
   const minus=document.createElement('button');minus.type='button';minus.className='dyws-item-minus';minus.textContent='−';minus.setAttribute('aria-label','Remove one '+item.name);minus.dataset.dywsAction='remove';
   const quantity=document.createElement('output');quantity.setAttribute('aria-label',item.name+' quantity');quantity.setAttribute('aria-live','polite');quantity.textContent='0';
   const plus=document.createElement('button');plus.type='button';plus.className='dyws-item-plus';plus.textContent='+';plus.setAttribute('aria-label','Add one '+item.name);plus.dataset.dywsAction='add';
   stepper.append(minus,quantity,plus);controls.append(add,stepper);action.append(price,controls);row.append(info,action);dishes.append(row);
  }
  menu.append(section);
 }
 loading?.remove();
 configureOptions();updateItemCounts();decorate();
}
 function updatePrices(){
 for(const controls of container.querySelectorAll('[data-order-item]')){
  const item=ordering.catalog.categories.flatMap(c=>c.items).find(i=>i.id===controls.dataset.orderItem&&i.active!==false);
  const row=controls.closest('.dyws-product'),select=row.querySelector('select');
  if(!item){row.remove();continue;}
  if(select){const selected=select.value;select.replaceChildren(...(item.variants||[]).map(v=>{const o=document.createElement('option');o.value=v.id;o.textContent=v.name;return o;}));if(item.variants?.some(v=>v.id===selected))select.value=selected;}
  row.querySelector('.dyws-product-action > span').textContent=money(item.variants?.find(v=>v.id===select?.value)?.price??item.price);
 }
 }
 const click=event=>{const button=event.target.closest('[data-dyws-action]');if(!button||!container.contains(button)||button.disabled)return;const controls=button.closest('[data-order-item]');const variant=controls.closest('.dyws-product').querySelector('select')?.value||'';const selections=selectionsFor(controls.closest('.dyws-product'));if(button.dataset.dywsAction==='remove')ordering.remove(controls.dataset.orderItem,variant,selections);else ordering.add(controls.dataset.orderItem,variant,selections);};
 const change=event=>{if(event.target.matches('select,[data-choice-group],input[type=radio]')){updatePrices();updateItemCounts();}};
 container.addEventListener('click',click);container.addEventListener('change',change);
 ordering.addEventListener('ordering-ready',render);
 if(ordering.catalog)render();
 return {render,destroy(){ordering.removeEventListener('ordering-ready',render);ordering.removeEventListener('cart-change',updateItemCounts);container.removeEventListener('click',click);container.removeEventListener('change',change);}};
}
