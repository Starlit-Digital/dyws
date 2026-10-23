export function pluginSlot(container,name){
 const doc=container.ownerDocument||globalThis.document;
 const previous=container.querySelector('[data-dyws-slot="'+name+'"]');
 const slot=doc.createElement('div');slot.dataset.dywsSlot=name;slot.className='dyws-plugin-area';
 if(previous)previous.replaceWith(slot);else container.append(slot);
 return slot;
}
