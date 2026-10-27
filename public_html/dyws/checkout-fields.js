// Keep native label associations and visible captions after host plugins add fields.
export function frameCheckoutFields(form){
 for(const label of form.querySelectorAll('label')){
  const input=label.querySelector('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]),select,textarea');
  if(!input||label.classList.contains('dyws-field'))continue;
  const textNodes=[...label.childNodes].filter(node=>node.nodeType===3),caption=textNodes.map(node=>node.textContent).join('').trim();
  if(!caption)continue;
  const title=form.ownerDocument.createElement('span');title.className='dyws-field-label';title.textContent=caption;
  textNodes.forEach(node=>node.remove());label.prepend(title);label.classList.add('dyws-field');
  if(!input.id&&input.name)input.id='dyws-checkout-'+input.name;
  if(input.id)label.htmlFor=input.id;
 }
}

export function clearFieldError(input){
 if(!input?.dataset?.dywsErrorId)return;
 const id=input.dataset.dywsErrorId;
 input.getRootNode().querySelector('#'+id)?.remove();
 const described=(input.getAttribute('aria-describedby')||'').split(' ').filter(value=>value&&value!==id);
 if(described.length)input.setAttribute('aria-describedby',described.join(' '));else input.removeAttribute('aria-describedby');
 input.removeAttribute('aria-invalid');delete input.dataset.dywsErrorId;
}
export function fieldError(input,message,{focus=true}={}){
 clearFieldError(input);
 const error=input.ownerDocument.createElement('span');error.className='dyws-field-error';
 error.id='dyws-error-'+input.name;error.textContent=message;
 input.dataset.dywsErrorId=error.id;input.setAttribute('aria-invalid','true');
 input.setAttribute('aria-describedby',[(input.getAttribute('aria-describedby')||''),error.id].filter(Boolean).join(' '));
 input.after(error);if(focus)input.focus();
}
export function validateFields(form){
 let first;
 const labels={customer:'Enter a name.',phone:'Enter a phone number.',email:'Enter a valid email address.',addressLine1:'Enter an address.',tipDollars:'Enter whole dollars.',pickupDate:'Choose a date.',pickupHour:'Choose an hour.',pickupMinute:'Choose minutes.',locationId:'Choose a store.'};
 for(const input of form.elements){
  clearFieldError(input);
  if(!input.willValidate||input.checkValidity())continue;
  fieldError(input,labels[input.name]||input.validationMessage,{focus:false});first??=input;
 }
 if(first){first.focus();return false;}return true;
}
