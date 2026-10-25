const base='/manager/plugins/order-printer';
const stateNames={queued:'Waiting',leased:'Preparing to print',printing:'Printing',sent:'Sent to printer',uncertain:'Needs review',cancelled:'Cancelled'};
function node(doc,tag,text){const el=doc.createElement(tag);if(text!==undefined)el.textContent=text;return el;}
export function register(plugin){
 const doc=plugin.document;let disposed=false,timer;
 plugin.onDestroy(()=>{disposed=true;clearInterval(timer);});
 plugin.addAction('admin:settings',async({root,api})=>{
  const target=root.querySelector('[data-dyws-plugin-settings]');if(!target||target.querySelector('#plugin-order-printer'))return;
  const panel=node(doc,'section');panel.id='plugin-order-printer';panel.className='dyws-printer-panel';
  panel.append(node(doc,'h2','Order Printer'),node(doc,'p','Connect the printer to its own setup Wi Fi, enter the venue network, then pair it with the code below. Accepted orders print through the DYWS backend. This is a hardware pilot.'));
  const status=node(doc,'p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const form=node(doc,'form');form.className='dyws-printer-form';
  const field=(title,control)=>{const label=node(doc,'label',title);label.append(control);form.append(label);return control;};
  const name=field('Printer name',node(doc,'input'));name.required=true;name.maxLength=80;name.placeholder='Kitchen';
  const location=field('Business location',node(doc,'select')),profile=field('Printer model',node(doc,'select'));
  const add=node(doc,'button','Create pairing code');add.type='submit';form.append(add);
  const pairing=node(doc,'div');pairing.className='dyws-printer-pairing';pairing.hidden=true;
  const devices=node(doc,'div'),jobs=node(doc,'div'),refresh=node(doc,'button','Refresh printer status');refresh.type='button';
  panel.append(form,pairing,refresh,status,devices,jobs);target.append(panel);
  const request=(route,body)=>api(base+route,{token:sessionStorage.getItem('dyws-manager'),...(body?{method:'POST',body}:{}),timeoutMs:10000});
  let busy=false;
  const action=async(button,body)=>{button.disabled=true;try{await request('/manage',body);status.textContent='Printer updated.';await load(false);}catch(error){status.textContent=error.message;}finally{button.disabled=false;}};
  const button=(parent,title,body)=>{const el=node(doc,'button',title);el.type='button';const requestId=crypto.randomUUID();el.onclick=()=>action(el,{...body,requestId});parent.append(el);};
  async function load(initial){
   if(busy||disposed)return;busy=true;
   try{
    const data=await request('/settings');if(disposed)return;
    if(initial){
     location.replaceChildren();for(const item of data.locations.length?data.locations:[{id:'',name:'Default business location'}]){const opt=node(doc,'option',item.name);opt.value=item.id;location.append(opt);}
     for(const [id,item]of Object.entries(data.profiles)){const opt=node(doc,'option',item.label);opt.value=id;profile.append(opt);}profile.value='epson80';
    }
    devices.replaceChildren(node(doc,'h3','Printers'));
    if(!data.devices.length)devices.append(node(doc,'p','No printers paired yet.'));
    for(const item of data.devices){
     const card=node(doc,'article');card.className='dyws-printer-card';
     const last=item.last_seen?new Date(item.last_seen*1000).toLocaleString():'Never';
     const online=item.last_seen&&Date.now()/1000-item.last_seen<45;
     card.append(node(doc,'h4',item.name),node(doc,'p',!item.enabled?'Revoked':!item.paired?'Waiting for setup':online?'Connected':'Offline'),node(doc,'p',`Last contact: ${last}. Device status: ${item.device_status}.`));
     if(item.enabled&&item.paired)button(card,'Print test ticket',{printerId:item.id,action:'test'});
     if(item.enabled)button(card,'Revoke printer access',{printerId:item.id,action:'revoke'});
     devices.append(card);
    }
    jobs.replaceChildren(node(doc,'h3','Recent print jobs'),node(doc,'p','Sent means the device transmitted the ticket. Check the paper if an outcome is uncertain. Recovery copies are marked COPY / REPRINT.'));
    for(const job of data.jobs){
     const card=node(doc,'article');card.className='dyws-printer-card';
     const device=data.devices.find(item=>item.id===job.printer_id);
     card.append(node(doc,'strong',`${job.order_id||'Test ticket'} · ${device?.name||job.printer_id}`),node(doc,'p',`${stateNames[job.state]||job.state} · ${new Date(job.created_at*1000).toLocaleString()}`));
     if(device?.enabled&&['sent','uncertain'].includes(job.state))button(card,'Print marked copy',{printerId:job.printer_id,jobId:job.id,action:'reprint'});
     if(device?.enabled&&job.state==='uncertain')button(card,'Confirm paper printed',{printerId:job.printer_id,jobId:job.id,action:'resolve'});
     if(device?.enabled&&job.state==='uncertain')button(card,'Dismiss without another print',{printerId:job.printer_id,jobId:job.id,action:'dismiss'});
     jobs.append(card);
    }
   }catch(error){status.textContent=error.message||'Printer status is unavailable.';}finally{busy=false;}
  }
  form.addEventListener('submit',async event=>{
   event.preventDefault();add.disabled=true;
   try{
    const result=await request('/devices',{name:name.value,locationId:location.value,profile:profile.value});
    pairing.replaceChildren(node(doc,'h3','Pair this device'),node(doc,'p','Keep these details available while switching to the printer setup network. The code expires in 30 minutes and binds to one device.'));
    for(const [label,value]of [['Backend API address',result.apiBase],['Pairing code',result.enrollmentCode]]){
     const wrap=node(doc,'label',label),input=node(doc,'input');input.readOnly=true;input.value=value;input.autocomplete='off';wrap.append(input);pairing.append(wrap);
     const copy=node(doc,'button','Copy '+label.toLowerCase());copy.type='button';copy.onclick=async()=>{try{await navigator.clipboard.writeText(value);status.textContent='Copied.';}catch{input.focus();input.select();status.textContent='Select and copy the value.';}};pairing.append(copy);
    }
    const hide=node(doc,'button','Hide pairing details');hide.type='button';hide.onclick=()=>{pairing.replaceChildren();pairing.hidden=true;};pairing.append(hide);pairing.hidden=false;
    name.value='';status.textContent='Pairing code created. Connect your phone to the printer setup network.';await load(false);
   }catch(error){status.textContent=error.message;}finally{add.disabled=false;}
  });
  refresh.onclick=()=>load(false);await load(true);
  timer=setInterval(()=>{if(!doc.hidden&&!panel.contains(doc.activeElement))void load(false);},15000);
 });
}
