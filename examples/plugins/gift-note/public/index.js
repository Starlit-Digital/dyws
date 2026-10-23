export function register(plugin){
 plugin.addAction('catalog:item',({root,item})=>{
  const note=plugin.document.createElement('small');note.textContent='Gift note available';root.append(note);
 });
 plugin.addAction('checkout:fields',({root,pluginData})=>{
  const label=plugin.document.createElement('label');label.textContent='Gift note, optional';
  const input=plugin.document.createElement('textarea');input.name='giftNote';input.maxLength=200;
  input.addEventListener('input',()=>{pluginData['gift-note']={message:input.value.trim()};});
  label.append(input);root.append(label);
 });
 plugin.addValidator('checkout:validating',({pluginData})=>{
  if(new TextEncoder().encode(pluginData['gift-note']?.message||'').length>200)throw new Error('Keep the gift note within 200 bytes.');
 });
 plugin.addAction('admin:order',({root,order})=>{
  const message=order.pluginData?.['gift-note']?.message;if(!message)return;
  const note=plugin.document.createElement('p');note.textContent='Gift note: '+message;root.append(note);
 });
}
