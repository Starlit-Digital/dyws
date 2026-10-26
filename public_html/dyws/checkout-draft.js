// Checkout navigation state stays in memory for this page session only.
const fields=['customer','phone','locationId','fulfillment','addressLine1','addressLine2','addressPostal','addressCity','addressRegion','addressCountry','notes','rememberDetails','savedProfileId','savedAddressId','addressLabel','customAddressLabel','defaultAddress'];
export function captureCheckout(form){
 return [...form.elements].filter(input=>fields.includes(input.name)&&(input.type!=='radio'||input.checked)).map(input=>({name:input.name,value:input.value,checked:input.type==='checkbox'?input.checked:undefined,addressLine1:input.dataset?.dywsAddressLine1,addressDisplay:input.dataset?.dywsAddressDisplay}));
}
export function restoreCheckout(form,draft=[]){
 for(const saved of draft){
  const inputs=[...form.elements].filter(input=>input.name===saved.name);
  if(!inputs.length&&['addressCity','addressRegion','addressCountry'].includes(saved.name)&&form.ownerDocument){
   const input=form.ownerDocument.createElement('input');input.type='hidden';input.name=saved.name;form.append(input);inputs.push(input);
  }
  for(const input of inputs){
   if(input.type==='checkbox'){input.checked=saved.checked===true;continue;}
   if(input.type==='radio'){input.checked=input.value===saved.value;continue;}
   if(input.tagName==='SELECT'&&![...input.options].some(option=>option.value===saved.value&&!option.disabled))continue;
   input.value=saved.value;
   if(saved.addressLine1!==undefined)input.dataset.dywsAddressLine1=saved.addressLine1;
   if(saved.addressDisplay!==undefined)input.dataset.dywsAddressDisplay=saved.addressDisplay;
  }
 }
}
