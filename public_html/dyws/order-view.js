/** Preserve semantic control state across failed actions and DOM replacement. */
export function lockOrderControls(root,selector='button,select'){
 const saved=[...root.querySelectorAll(selector)].map(node=>[node,node.disabled]);
 for(const [node] of saved)node.disabled=true;
 return ()=>{for(const [node,disabled] of saved)if(node.isConnected)node.disabled=disabled;};
}
const disclosureKey=(node,index)=>node.id||node.dataset?.dywsDisclosure||String(index);
const focusKey=node=>JSON.stringify([node.tagName,node.id||'',node.name||'',node.dataset||{},node.closest?.('[data-order]')?.dataset?.order||'']);
/** Callers supply their own markup. This module owns refresh, disclosure and focus behavior only. */
export function createOrderView({root,render,key=JSON.stringify}){
 let signature,rendered=false;
 return {
  update(value,{force=false}={}){
   const next=key(value);if(rendered&&next===signature&&!force)return false;
   const doc=root.ownerDocument,focused=doc?.activeElement,inside=focused&&focused!==root&&root.contains(focused);
   if(!force&&inside&&focused.matches?.('input,select,textarea,[contenteditable="true"]'))return false;
   const open=new Map([...root.querySelectorAll('details')].map((node,index)=>[disclosureKey(node,index),node.open]));
   const identity=inside?focusKey(focused):null;
   render(value);signature=next;rendered=true;
   [...root.querySelectorAll('details')].forEach((node,index)=>{const k=disclosureKey(node,index);if(open.has(k))node.open=open.get(k);});
   if(identity){const replacement=[...root.querySelectorAll('button,a,input,select,textarea,[tabindex]')].find(node=>!node.disabled&&focusKey(node)===identity);if(replacement)replacement.focus({preventScroll:true});else{root.tabIndex=-1;root.focus({preventScroll:true});}}
   return true;
  },
  clear(){rendered=false;signature=undefined;}
 };
}
export function focusOrder(root,id,{scroll=true}={}){
 const card=[...root.querySelectorAll('[data-order]')].find(node=>node.dataset.order===id);if(!card)return false;
 card.tabIndex=-1;card.focus({preventScroll:true});if(scroll)card.scrollIntoView({block:'nearest',behavior:'instant'});return true;
}
