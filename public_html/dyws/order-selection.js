/** An order ID selects already authorized UI data. It never grants order access. */
export const validOrderId=value=>typeof value==='string'&&/^DYWS-[A-F0-9]{12}$/.test(value)?value:null;
export function readOrderSelection(href){
 if(!href)return null;
 return validOrderId(new URLSearchParams(new URL(href).hash.slice(1)).get('order'));
}
export function orderSelectionURL(href,id){
 const url=new URL(href),selection=validOrderId(id);
 url.hash=selection?'order='+selection:'';return url.href;
}
export function writeOrderSelection(view,id){
 if(view)view.history.replaceState(view.history.state,'',orderSelectionURL(view.location.href,id));
}

/** Focus a requested driver card once, while polling can replace its DOM. */
export function mountDriverOrderSelection({root,view=root.ownerDocument?.defaultView}){
 const doc=root.ownerDocument||root,notice=doc.createElement('p');
 notice.className='dyws-note';notice.setAttribute('role','status');notice.hidden=true;
 root.querySelector('#driver-board').prepend(notice);
 let focused=null;
 function update(){
  const id=readOrderSelection(view?.location.href),cards=[...root.querySelectorAll('#deliveries article[data-order]')];
  const selected=cards.find(card=>card.dataset.order===id);
  for(const card of cards){if(card===selected)card.setAttribute('data-dyws-selected-order','');else card.removeAttribute('data-dyws-selected-order');}
  notice.hidden=!id;notice.textContent=!id?'':selected?'Selected order: '+id+'.':'Order '+id+' is not in your active deliveries. Only ready or active deliveries assigned to you appear here.';
  if(!id){focused=null;return;}
  if(selected&&focused!==id){focused=id;selected.tabIndex=-1;selected.focus({preventScroll:true});selected.scrollIntoView({block:'center',behavior:'instant'});}
 }
 view?.addEventListener('hashchange',update);
 return {update,destroy(){view?.removeEventListener('hashchange',update);notice.remove();}};
}
