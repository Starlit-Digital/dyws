import {resolveItem} from './cart.js';
/** Optional cart UI. Callers supply current public items and the supported add operation. */
export function mountCartSuggestions({root,items,addItem,currency='CAD'}) {
  const doc=root.ownerDocument, money=new Intl.NumberFormat('en-CA',{style:'currency',currency});
  root.replaceChildren();root.hidden=true;
  if(!Array.isArray(items)||!items.length)return;
  const heading=doc.createElement('h3');heading.textContent='Add something?';root.append(heading);
  for(const item of items.slice(0,3)) {
    const card=doc.createElement('div');card.className='dyws-suggestion';
    const title=doc.createElement('strong');title.textContent=item.name;card.append(title);
    const choices=doc.createElement('div');choices.hidden=true;card.append(choices);
    const selected=()=>Object.fromEntries((item.optionGroups||[]).map(g=>[g.id,[...choices.querySelectorAll('input')].filter(i=>i.dataset.group===g.id&&i.checked).map(i=>i.value)]));
    let variant;
    if(item.variants?.length){const label=doc.createElement('label');label.textContent=item.optionLabel||'Option';variant=doc.createElement('select');variant.setAttribute('aria-label',item.name+' '+label.textContent);const prompt=doc.createElement('option');prompt.value='';prompt.textContent='Choose an option';variant.append(prompt);for(const v of item.variants){const o=doc.createElement('option');o.value=v.id;o.textContent=v.name+' · '+money.format(v.price/100);variant.append(o);}label.append(variant);choices.append(label);}
    for(const group of item.optionGroups||[]){const field=doc.createElement('fieldset'),legend=doc.createElement('legend');legend.textContent=`${group.name} (choose ${group.min} to ${group.max})`;field.append(legend);for(const choice of group.choices){const label=doc.createElement('label'),input=doc.createElement('input');input.type='checkbox';input.value=choice.id;input.dataset.group=group.id;label.append(input,doc.createTextNode(choice.name+(choice.price?' + '+money.format(choice.price/100):'')));field.append(label);}choices.append(field);}
    const price=doc.createElement('p');price.textContent=(item.variants?.length?'From ':'')+money.format((item.variants?.length?Math.min(...item.variants.map(v=>v.price)):item.price)/100);card.append(price);
    const error=doc.createElement('p');error.setAttribute('role','status');error.className='dyws-suggestion-error';card.append(error);
    const button=doc.createElement('button');button.type='button';button.textContent=(item.variants?.length||item.optionGroups?.length?'Choose ':'Add ')+item.name;card.append(button);
    const update=()=>{try{const line=resolveItem({categories:[{items:[item]}]},item.id,variant?.value||'',selected());price.textContent=money.format(line.price/100);error.textContent='';}catch{price.textContent='Choose your options to see the price.';}};
    choices.addEventListener('change',update);
    button.addEventListener('click',()=>{if(choices.hidden&&(item.variants?.length||item.optionGroups?.length)){choices.hidden=false;button.textContent='Add '+item.name;choices.querySelector('select,input')?.focus();update();return;}try{const selection={id:item.id,variant:variant?.value||'',selections:selected()};resolveItem({categories:[{items:[item]}]},selection.id,selection.variant,selection.selections);if(addItem(selection)===false)error.textContent='This suggestion changed. Review your cart and try again.';}catch(e){error.textContent=e.message;}});
    root.append(card);
  }
  root.hidden=false;
}
