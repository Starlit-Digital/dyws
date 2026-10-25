// Checkout navigation state stays in memory for this page session only.
const fields=['customer','phone','locationId','fulfillment','addressLine1','addressLine2','addressPostal','addressCity','addressRegion','addressCountry','notes'];
export function captureCheckout(form){
 return [...form.elements].filter(input=>fields.includes(input.name)&&(!['radio','checkbox'].includes(input.type)||input.checked)).map(input=>({name:input.name,value:input.value,addressLine1:input.dataset?.dywsAddressLine1,addressDisplay:input.dataset?.dywsAddressDisplay}));
}
export function restoreCheckout(form,draft=[]){
 for(const saved of draft){
  const inputs=[...form.elements].filter(input=>input.name===saved.name);
  for(const input of inputs){
   if(input.type==='radio'){input.checked=input.value===saved.value;continue;}
   if(input.tagName==='SELECT'&&![...input.options].some(option=>option.value===saved.value&&!option.disabled))continue;
   input.value=saved.value;
   if(saved.addressLine1!==undefined)input.dataset.dywsAddressLine1=saved.addressLine1;
   if(saved.addressDisplay!==undefined)input.dataset.dywsAddressDisplay=saved.addressDisplay;
  }
 }
}
