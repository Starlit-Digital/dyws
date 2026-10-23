import {escapeHTML as esc} from './api.js';
import {adminPage} from './admin-navigation.js?v=32';

export function decimalToMinor(value) {
 if(!/^\d+(\.\d{1,2})?$/.test(String(value)))throw new Error('Enter an amount with up to two decimal places.');
 const [whole,fraction='']=String(value).split('.');const result=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 if(!Number.isSafeInteger(result))throw new Error('Amount is too large.');return result;
}
export function createCatalogDraft(catalog){return structuredClone(catalog);}
export async function mountCatalogEditor({root=document,api,storageKey}) {
 const page=adminPage({root,api,storageKey});if(!page.token)return;
 const form=root.querySelector('#catalog-editor'),list=root.querySelector('#category-list'),editor=root.querySelector('#category-editor'),message=root.querySelector('#catalog-message');
 let draft,revision,selected=0,dirty=false,busy=false;
 const id=prefix=>prefix+'_'+crypto.randomUUID().replaceAll('-','').slice(0,16);
 const amount=n=>(n/100).toFixed(2);
 const mark=()=>{dirty=true;message.textContent='Unsaved changes';};
 const get=path=>path.split('.').reduce((v,k)=>v?.[k],draft);
 const set=(path,value)=>{const keys=path.split('.');let target=draft;for(const k of keys.slice(0,-1)){if(!target[k])target[k]={};target=target[k];}target[keys.at(-1)]=value;};
 const field=(label,path,{type='text',required=false,money=false,max=120}={})=>{
  const value=get(path)??'';return `<label>${esc(label)}<input data-field="${path}" ${money?'data-minor="true"':''} type="${type}" value="${esc(money?amount(value||0):value)}" ${required?'required':''} ${type==='number'?'min="0" step="0.01"':'maxlength="'+max+'"'}></label>`;
 };
 const check=(label,path)=>`<label class="dyws-checkbox"><input type="checkbox" data-field="${path}" ${get(path)?'checked':''}> ${esc(label)}</label>`;
 function imageFields(path){return field('Image URL',path+'.src',{max:1000})+field('Image description',path+'.alt',{max:250});}
 function renderBusiness(){
  root.querySelector('#business-fields').innerHTML=field('Business name','businessName',{required:true})+field('Ordering system name','platformName',{required:true,max:100})+field('Pickup address','pickupAddress',{max:240})+`<label>Currency<input value="${esc(draft.currency)}" disabled></label>`+field('Tax rate (%)','taxBasisPoints',{type:'number',money:true,required:true})+field('Delivery fee','deliveryFee',{type:'number',money:true,required:true});
 }
 function renderCategories(){
  list.replaceChildren(...draft.categories.map((c,index)=>{const b=document.createElement('button');b.type='button';b.textContent=c.name||'Untitled category';b.setAttribute('aria-pressed',String(index===selected));b.onclick=()=>{if(!form.reportValidity())return;selected=index;renderCategories();renderCategory();};return b;}));
 }
 function renderCategory(){
  const category=draft.categories[selected];if(!category){editor.innerHTML='<p>Add a category to start building your catalog.</p>';return;}
  const path=`categories.${selected}`;
  editor.innerHTML=`<div class="dyws-editor-heading"><h2>Category details</h2><div class="dyws-actions"><button type="button" data-action="category-up" ${selected===0?'disabled':''}>Move up</button><button type="button" data-action="category-down" ${selected===draft.categories.length-1?'disabled':''}>Move down</button><button type="button" data-action="category-remove" class="dyws-secondary">Remove category</button></div></div><div class="dyws-field-grid">${field('Category name',path+'.name',{required:true})}${imageFields(path+'.image')}</div><div class="dyws-editor-heading"><h2>Items</h2><button type="button" data-action="item-add">Add item</button></div><div id="item-list"></div>`;
  const items=editor.querySelector('#item-list');
  for(const [index,item] of category.items.entries()){
   const p=path+`.items.${index}`,card=document.createElement('details');card.className='dyws-item-editor';card.dataset.itemIndex=index;
   card.innerHTML=`<summary><span>${esc(item.name||'New item')}</span><span>${esc(draft.currency)} ${amount(item.price)}${item.active?'':' · Hidden'}</span></summary><div class="dyws-field-grid">${field('Item name',p+'.name',{required:true})}${field('Price',p+'.price',{type:'number',money:true,required:true})}<label class="dyws-wide">Description<textarea data-field="${p}.description" maxlength="2000">${esc(item.description)}</textarea></label>${field('SKU',p+'.sku',{max:80})}${field('Unit',p+'.unit',{required:true,max:40})}${imageFields(p+'.image')}${check('Available to order',p+'.active')}</div><div class="dyws-variants"><h3>Options</h3>${field('Option label',p+'.optionLabel',{max:60})}<div data-variants></div><button type="button" data-action="variant-add" data-item="${index}">Add option</button></div><div class="dyws-actions"><button type="button" data-action="item-up" data-item="${index}" ${index===0?'disabled':''}>Move up</button><button type="button" data-action="item-down" data-item="${index}" ${index===category.items.length-1?'disabled':''}>Move down</button><button type="button" data-action="item-remove" data-item="${index}" class="dyws-secondary">Remove item</button></div>`;
   const variants=card.querySelector('[data-variants]');
   for(const [v,variant] of (item.variants||[]).entries())variants.insertAdjacentHTML('beforeend',`<div class="dyws-option-row">${field('Option name',p+`.variants.${v}.name`,{required:true,max:100})}${field('Option price',p+`.variants.${v}.price`,{type:'number',money:true,required:true})}<button type="button" data-action="variant-remove" data-item="${index}" data-variant="${v}" class="dyws-secondary">Remove option</button></div>`);
   items.append(card);
  }
 }
 function render(){renderBusiness();renderCategories();renderCategory();}
 function cleaned(){
  const result=createCatalogDraft(draft);
  for(const c of result.categories){if(!c.image?.src?.trim())delete c.image;for(const i of c.items){if(!i.image?.src?.trim())delete i.image;if(!i.variants?.length){delete i.variants;delete i.optionLabel;}else if(!i.optionLabel?.trim())i.optionLabel='Option';}}
  return result;
 }
 async function load(){const data=await page.request('/manager/catalog');draft=createCatalogDraft(data.catalog);revision=data.revision;selected=Math.min(selected,Math.max(0,draft.categories.length-1));dirty=false;render();message.textContent='';}
 form.addEventListener('input',event=>{
  const input=event.target;if(!input.dataset.field)return;
  mark();
  let value=input.type==='checkbox'?input.checked:input.value;
  if(input.dataset.minor){try{value=decimalToMinor(value);}catch{return;}}
  set(input.dataset.field,value);mark();
  if(input.dataset.field===`categories.${selected}.name`)renderCategories();
  const card=input.closest('.dyws-item-editor');if(card){const item=draft.categories[selected].items[Number(card.dataset.itemIndex)];card.querySelector('summary span').textContent=item.name||'New item';card.querySelector('summary span:last-child').textContent=`${draft.currency} ${amount(item.price)}${item.active?'':' · Hidden'}`;}
 });
 form.addEventListener('invalid',event=>{const detail=event.target.closest('details');if(detail)detail.open=true;},true);
 function mutate(action,itemIndex,variantIndex){
  if(!action.endsWith('remove')&&!form.reportValidity())return;
  const c=draft.categories[selected],items=c?.items;let focusItem=itemIndex;
  if(action==='category-add'){if(!form.reportValidity())return;draft.categories.push({id:id('category'),name:'New category',items:[]});selected=draft.categories.length-1;}
  if(action==='category-remove'){if(!confirm('Remove this category and its items from the draft? Save catalog to apply.'))return;draft.categories.splice(selected,1);selected=Math.max(0,selected-1);}
  if(action==='category-up'||action==='category-down'){const other=selected+(action.endsWith('up')?-1:1);[draft.categories[selected],draft.categories[other]]=[draft.categories[other],draft.categories[selected]];selected=other;}
  if(action==='item-add'){items.push({id:id('item'),name:'New item',description:'',price:0,active:true,sku:'',unit:'each',metadata:[]});focusItem=items.length-1;}
  if(action==='item-remove'){if(!confirm('Remove this item from the draft? Save catalog to apply.'))return;items.splice(itemIndex,1);}
  if(action==='item-up'||action==='item-down'){const other=itemIndex+(action.endsWith('up')?-1:1);[items[itemIndex],items[other]]=[items[other],items[itemIndex]];focusItem=other;}
  if(action==='variant-add'){(items[itemIndex].variants??=[]).push({id:id('option'),name:'New option',price:items[itemIndex].price});items[itemIndex].optionLabel||='Option';}
  if(action==='variant-remove')items[itemIndex].variants.splice(variantIndex,1);
  mark();renderCategories();renderCategory();
  if(Number.isInteger(focusItem))editor.querySelector(`[data-item-index="${focusItem}"]`)?.setAttribute('open','');
 }
 form.addEventListener('click',event=>{const button=event.target.closest('[data-action]');if(!button||busy||button.disabled)return;mutate(button.dataset.action,button.dataset.item===undefined?undefined:Number(button.dataset.item),Number(button.dataset.variant));});
 form.onsubmit=event=>{event.preventDefault();if(busy)return;page.action(event.submitter,async()=>{busy=true;form.querySelector('fieldset').disabled=true;try{const data=await page.request('/manager/catalog',{method:'POST',body:{catalog:cleaned(),revision}});draft=createCatalogDraft(data.catalog);revision=data.revision;dirty=false;render();message.textContent='Catalog saved. The storefront now uses these categories and items.';}finally{busy=false;form.querySelector('fieldset').disabled=false;}});};
 root.querySelector('#reload-catalog').onclick=event=>{if(dirty&&!confirm('Discard your unsaved changes and reload the saved catalog?'))return;page.action(event.target,load);};
 window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
 try{await load();}catch(e){page.error.textContent=e.message;}
}
