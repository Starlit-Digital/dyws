import './component.js?v=5';
const ordering=document.querySelector('restaurant-ordering');
ordering.submitOrder=async order=>({id:'STAR-'+order.idempotencyKey.slice(0,8).toUpperCase(),demo:true});
function updateItemCounts(){
 for(const controls of document.querySelectorAll('[data-order-item]')){
  const variant=controls.closest('.dish').querySelector('select')?.value||'';
  const count=ordering.lines.find(line=>line.id===controls.dataset.orderItem && line.variant===variant)?.quantity||0;
  const add=controls.querySelector('.item-add');
  const stepper=controls.querySelector('.item-stepper');
  const minus=controls.querySelector('.item-minus');
  const plus=controls.querySelector('.item-plus');
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
 for(const category of ordering.catalog.categories){
  const section=document.createElement('section');section.id=category.id;
  const heading=document.createElement('h2');heading.textContent=category.name;section.append(heading);
  for(const item of category.items){
   const row=document.createElement('article');row.className='dish';
   const info=document.createElement('div');const title=document.createElement('h3');title.textContent=item.name;const description=document.createElement('p');description.textContent=item.description;info.append(title,description);
   let select;
   if(item.variants){const label=document.createElement('label');label.textContent='Flavour ';select=document.createElement('select');select.setAttribute('aria-label',item.name+' flavour');for(const variant of item.variants){const option=document.createElement('option');option.value=variant.id;option.textContent=variant.name;select.append(option);}label.append(select);info.append(label);}
   const action=document.createElement('div');action.className='dish-action';
   const price=document.createElement('span');price.textContent=money(item.price);
   const controls=document.createElement('div');controls.className='item-controls';controls.dataset.orderItem=item.id;
   const add=document.createElement('button');add.type='button';add.className='item-add';add.textContent='Add';add.setAttribute('aria-label','Add '+item.name);add.onclick=()=>ordering.add(item.id,select?.value||'');
   const stepper=document.createElement('div');stepper.className='item-stepper';stepper.hidden=true;stepper.setAttribute('role','group');stepper.setAttribute('aria-label',item.name+' quantity');
   const minus=document.createElement('button');minus.type='button';minus.className='item-minus';minus.textContent='−';minus.setAttribute('aria-label','Remove one '+item.name);minus.onclick=()=>ordering.remove(item.id,select?.value||'');
   const quantity=document.createElement('output');quantity.setAttribute('aria-label',item.name+' quantity');quantity.setAttribute('aria-live','polite');quantity.textContent='0';
   const plus=document.createElement('button');plus.type='button';plus.className='item-plus';plus.textContent='+';plus.setAttribute('aria-label','Add one '+item.name);plus.onclick=()=>ordering.add(item.id,select?.value||'');
   stepper.append(minus,quantity,plus);controls.append(add,stepper);action.append(price,controls);row.append(info,action);section.append(row);
   if(select)select.addEventListener('change',updateItemCounts);
  }
  menu.append(section);
 }
 document.querySelector('#loading').remove();
 updateItemCounts();
});
