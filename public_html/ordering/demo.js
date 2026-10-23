import './component.js?v=2';
const ordering=document.querySelector('restaurant-ordering');
ordering.submitOrder=async order=>({id:'STAR-'+order.idempotencyKey.slice(0,8).toUpperCase(),demo:true});
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
   const action=document.createElement('div');action.className='dish-action';const price=document.createElement('span');price.textContent=money(item.price);const add=document.createElement('button');add.type='button';add.textContent='Add';add.setAttribute('aria-label','Add '+item.name);add.onclick=()=>ordering.add(item.id,select?.value||'');action.append(price,add);row.append(info,action);section.append(row);
  }
  menu.append(section);
 }
 document.querySelector('#loading').remove();
});
const themeButton=document.querySelector('#theme');
function applyTheme(light){document.documentElement.dataset.theme=light?'light':'dark';themeButton.textContent=light?'Dark mode':'Light mode';themeButton.setAttribute('aria-pressed',String(light));}
try{applyTheme(localStorage.getItem('starlit-diner-theme')==='light');}catch{}
themeButton.onclick=()=>{const light=document.documentElement.dataset.theme!=='light';applyTheme(light);try{localStorage.setItem('starlit-diner-theme',light?'light':'dark');}catch{}};
