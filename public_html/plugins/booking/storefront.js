import {formatPhoneField,formatPhoneInput} from '../../dyws/phone-input.js';
/** Host supplies API endpoint and root. Contact fields never enter browser storage. */
export async function mountBooking(root,{endpoint='api/'}={}){
 const doc=root.ownerDocument;
 const stylesheet=new URL('./pills.css?v=receipt-tab',import.meta.url).href;
 if(![...doc.querySelectorAll('link[rel=stylesheet]')].some(link=>link.href===stylesheet)){
  const link=doc.createElement('link');link.rel='stylesheet';link.href=stylesheet;doc.head.append(link);
 }let revision=0,requestKey=null,requestFingerprint=null;
 const node=(tag,text)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const api=async(route,body)=>{const u=new URL(endpoint,doc.baseURI);u.searchParams.set('route',route);const r=await fetch(u,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,cache:'no-store',credentials:'same-origin'});const d=await r.json();if(!r.ok)throw Error(d.error||d.message||'Unable to complete this request. Please try again.');return d;};
 const status=node('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');root.append(status);
 try{
  const settings=await api('/plugins/booking/services');if(!settings.services.length){status.textContent='No appointments are available right now. Please try again later.';return;}const form=node('form');const date={value:'',disabled:true};
  const group=(title,name)=>{
   const box=node('fieldset');box.className='dyws-booking-pills';box.append(node('legend',title));
   const choices=node('div');box.append(choices);
   return {box,choices,get value(){return choices.querySelector('input:checked')?.value??'';},
    add(value,text,checked=false,content=null){const input=node('input');input.type='radio';input.name=name;input.value=value;input.required=true;input.checked=checked;const label=node('label');label.append(input,content??node('span',text));choices.append(label);}};
  };
  const service=group('Service','service'),slots=group('Available times','slot');
  date.required=true;
  const label=(text,input)=>{const l=node('label',text);l.append(input);form.append(l);};
  const images=root.dataset.serviceImages;
  if(images)service.box.classList.add('dyws-booking-cards');
  settings.services.forEach((s,i)=>{
   const text=`${s.name}, ${s.duration} minutes`;
   if(!images){service.add(s.id,text,i===0);return;}
   const card=node('span');card.className='dyws-booking-card';
   const picture=node('picture'),source=node('source'),img=node('img');
   const path=new URL(encodeURIComponent(s.id),new URL(images,doc.baseURI)).href;
   source.type='image/webp';source.srcset=path+'.webp';
   img.src=path+'.jpg';img.alt='';img.width=img.height=512;img.loading='lazy';img.decoding='async';
   img.addEventListener('error',()=>picture.remove(),{once:true});
   picture.append(source,img);
   const info=node('span');info.className='dyws-booking-card-info';
   const action=node('strong','Select');action.setAttribute('aria-hidden','true');
   info.append(node('b',s.name),node('small',`${s.duration} minutes`),action);
   card.append(picture,info);
   service.add(s.id,text,i===0,card);
  });
  const calendar=node('fieldset');calendar.className='dyws-booking-calendar';
  calendar.append(node('legend',`Date, ${settings.timeZone}`));
  const monthLabel=node('strong');monthLabel.setAttribute('aria-live','polite');
  const previousMonth=node('button','Previous month'),nextMonth=node('button','Next month');
  previousMonth.type=nextMonth.type='button';
  const navigation=node('div');navigation.append(previousMonth,monthLabel,nextMonth);
  const grid=node('div');grid.className='dyws-booking-calendar-grid';calendar.append(navigation,grid);
  const monthFormat=new Intl.DateTimeFormat('en-CA',{month:'long',year:'numeric',timeZone:'UTC'});
  let openDates=[],month='';
  const iso=value=>value.toISOString().slice(0,10);
  function renderCalendar(){
   if(!month)return;
   const first=new Date(month+'-01T00:00:00Z');
   monthLabel.textContent=monthFormat.format(first);
   previousMonth.disabled=date.disabled||month<=openDates[0]?.slice(0,7);
   nextMonth.disabled=date.disabled||month>=openDates.at(-1)?.slice(0,7);
   grid.replaceChildren();
   for(const name of ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'])grid.append(node('span',name));
   for(let i=0;i<first.getUTCDay();i++)grid.append(node('span'));
   for(const day=new Date(first);day.getUTCMonth()===first.getUTCMonth();day.setUTCDate(day.getUTCDate()+1)){
    const value=iso(day),button=node('button',String(day.getUTCDate()));
    button.type='button';button.disabled=date.disabled||!openDates.includes(value);
    button.setAttribute('aria-label',dateFormat.format(day));
    button.setAttribute('aria-pressed',String(date.value===value));
    button.dataset.date=value;
    button.onclick=async()=>{date.value=value;await load();grid.querySelector(`[data-date="${value}"]:not(:disabled)`)?.focus();};
    grid.append(button);
   }
  }
  function moveMonth(delta){
   const first=new Date(month+'-01T00:00:00Z');first.setUTCMonth(first.getUTCMonth()+delta);
   month=iso(first).slice(0,7);renderCalendar();
  }
  previousMonth.onclick=()=>moveMonth(-1);nextMonth.onclick=()=>moveMonth(1);
  form.append(service.box);form.append(calendar);form.append(slots.box);
  const name=node('input'),phone=node('input');name.required=phone.required=true;name.maxLength=100;phone.maxLength=30;phone.type='tel';phone.pattern='[0-9+() .-]{7,30}';name.autocomplete='name';phone.autocomplete='tel';phone.placeholder='(780) 555-0142';phone.addEventListener('input',formatPhoneField);
  if(settings.demo){name.value='Demo Customer';phone.value=formatPhoneInput('7805550142');name.readOnly=phone.readOnly=true;}
  label('Name',name);label('Phone',phone);
  const email=node('input');email.type='email';email.maxLength=254;email.autocomplete='email';
  if(settings.confirmationEmailEnabled)label('Email for confirmation (optional)',email);
  const acknowledge=node('input');acknowledge.type='checkbox';acknowledge.required=true;label(settings.demo?'I understand this is a fictional demo appointment.':'I have reviewed the service, date and time.',acknowledge);
  acknowledge.parentElement.classList.add('dyws-booking-acknowledge');
  acknowledge.parentElement.prepend(acknowledge);
  const submit=node('button','Confirm appointment');submit.type='submit';form.append(submit);root.prepend(form);
  const availability=node('p');availability.setAttribute('role','status');slots.box.append(availability);
  const dateFormat=new Intl.DateTimeFormat('en-CA',{dateStyle:'full',timeZone:'UTC'});
  const load=async(refreshDates=false,preferredTime)=>{
   const version=++revision;
   const serviceId=service.value;
   const previous=date.value;
   submit.disabled=true;date.disabled=true;slots.choices.replaceChildren();requestKey=null;
   availability.textContent='Checking availability…';renderCalendar();
   try{
    let message='';
    if(refreshDates){
     const {today,dates}=await api('/plugins/booking/availability',{serviceId,listDates:true});
     if(version!==revision)return;
     openDates=dates;
     date.value=dates.includes(previous)?previous:(dates[0]??'');
     month=(date.value||today).slice(0,7);
     renderCalendar();
     if(!dates.length){
      availability.textContent='No appointments available in the next 90 days.';
      return;
     }
     if(!dates.includes(today)&&date.value===dates[0])message='No times left today. Showing the next available date.';
    }
    const data=await api('/plugins/booking/availability',{serviceId,date:date.value});
    if(version!==revision)return;
    for(const slot of data.slots)slots.add(String(slot.startsAt),slot.label,slot.startsAt===preferredTime);
    if(!data.slots.length)openDates=openDates.filter(value=>value!==date.value);
    date.disabled=!openDates.length;renderCalendar();submit.disabled=!data.slots.length;
    availability.textContent=data.slots.length?message:'This date no longer has openings. Choose another date.';
   }catch(e){if(version===revision){date.disabled=!openDates.length;renderCalendar();availability.textContent=e.message;}}
  };
  service.box.onchange=()=>load(true);slots.box.onchange=()=>{requestKey=null;};
  function showReceipt(receipt){
   form.hidden=true;
   status.textContent='';
   const card=node('section');card.className='dyws-booking-receipt';
   const title=node('h3',receipt.demo?'Demo appointment confirmed':'Appointment confirmed');title.tabIndex=-1;
   const mark=node('span','✓');mark.className='dyws-booking-receipt-mark';mark.setAttribute('aria-hidden','true');
   const starts=new Date(receipt.startsAt*1000),ends=new Date(receipt.endsAt*1000);
   const format=options=>new Intl.DateTimeFormat('en-CA',{...options,timeZone:receipt.timeZone});
   const tile=node('div');tile.className='dyws-booking-receipt-date';tile.setAttribute('aria-hidden','true');
   tile.append(node('span',format({month:'short'}).format(starts)),node('strong',format({day:'numeric'}).format(starts)));
   const summary=node('div');summary.className='dyws-booking-receipt-summary';
   const details=node('div');
   details.append(node('h4',receipt.serviceName),node('p',format({dateStyle:'full'}).format(starts)),
    node('p',format({timeStyle:'short'}).formatRange(starts,ends)+' · '+receipt.timeZone));
   summary.append(tile,details);
   const footer=node('div');footer.className='dyws-booking-receipt-footer';
   const reference=node('div');reference.append(node('span','Booking reference'),node('strong',receipt.id));
   const cancel=node('button','Cancel appointment');cancel.type='button';const actions=node('div');actions.className='dyws-booking-receipt-actions';
   const calendarButton=node('button','Download .ics');calendarButton.type='button';
   calendarButton.onclick=()=>downloadAppointment(receipt,doc);
   const google=node('a','Add to Google Calendar');
   const googleURL=new URL('https://calendar.google.com/calendar/r/eventedit');
   googleURL.search=new URLSearchParams({action:'TEMPLATE',text:receipt.serviceName,
    dates:[receipt.startsAt,receipt.endsAt].map(at=>calendarStamp(new Date(at*1000))).join('/'),
    stz:receipt.timeZone,etz:receipt.timeZone,details:calendarDetails(receipt)});
   google.href=googleURL.href;google.target='_blank';google.rel='noopener noreferrer';
   google.className='dyws-booking-google';
   actions.append(google,calendarButton,cancel);footer.append(reference,actions);
   const feedback=node('p');feedback.setAttribute('role','status');
   card.append(mark,title,summary);
   const emailPreview=receipt.demo?node('p','Confirmation email preview: this receipt shows the details included in the email.'):null;
   if(emailPreview)card.append(emailPreview);
   else if(receipt.confirmationEmail==='accepted')card.append(node('p','Confirmation email submitted for delivery.'));
   else if(receipt.confirmationEmail==='failed')card.append(node('p','The appointment is confirmed. The confirmation email could not be sent.'));
   card.append(footer,feedback);root.append(card);title.focus();
   cancel.onclick=async()=>{
    cancel.disabled=true;
    try{
     await api('/plugins/booking/cancel',{id:receipt.id,token:receipt.cancellationToken});
     card.dataset.cancelled='true';title.textContent='Appointment cancelled';
     const close=node('button','Close');close.type='button';close.className='dyws-booking-receipt-close';
     const dismiss=node('button','Dismiss');dismiss.type='button';dismiss.className='dyws-booking-receipt-dismiss';
     close.onclick=dismiss.onclick=()=>{card.remove();form.querySelector('input[name=service]:checked')?.focus();};
     mark.replaceWith(close);card.append(dismiss);
     emailPreview?.remove();
     actions.remove();title.focus();
     form.hidden=false;root.append(form);
     acknowledge.checked=false;requestFingerprint=null;
     await load(true,receipt.startsAt);
    }catch(e){feedback.textContent=e.message;cancel.disabled=false;}
   };
  }
  form.onsubmit=async event=>{
   event.preventDefault();if(!form.reportValidity())return;
   submit.disabled=true;
   const payload={serviceId:service.value,startsAt:Number(slots.value),customer:{name:name.value,phone:phone.value,...(email.value?{email:email.value}:{})},acknowledged:acknowledge.checked};
   const fingerprint=JSON.stringify(payload);
   if(requestFingerprint!==fingerprint){requestFingerprint=fingerprint;requestKey=crypto.randomUUID();}
   requestKey??=crypto.randomUUID();
   status.textContent='Confirming your appointment…';
   try{showReceipt(await api('/plugins/booking/reserve',{...payload,idempotencyKey:requestKey}));}
   catch(e){status.textContent=e.message;submit.disabled=false;}
  };
  await load(true);
 }catch(e){status.textContent=e.message;}
}

function downloadAppointment(receipt,doc){
 const escapeText=value=>String(value).replaceAll('\\','\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/[;,]/g,'\\$&');
 const encoder=new TextEncoder();
 const fold=line=>{
  let result='',bytes=0;
  for(const char of line){
   const size=encoder.encode(char).length;
   if(bytes+size>75){result+='\r\n ';bytes=1;}
   result+=char;bytes+=size;
  }
  return result;
 };
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//DYWS//Booking//EN','BEGIN:VEVENT',
  'UID:'+escapeText(receipt.id+'@'+doc.location.hostname),
  'DTSTAMP:'+calendarStamp(new Date()),
  'DTSTART:'+calendarStamp(new Date(receipt.startsAt*1000)),
  'DTEND:'+calendarStamp(new Date(receipt.endsAt*1000)),
  'SUMMARY:'+escapeText(receipt.serviceName),
  'DESCRIPTION:'+escapeText(calendarDetails(receipt)),
  'END:VEVENT','END:VCALENDAR'];
 const url=URL.createObjectURL(new Blob([lines.map(fold).join('\r\n')+'\r\n'],{type:'text/calendar;charset=utf-8'}));
 const link=doc.createElement('a');link.href=url;link.download=receipt.id+'.ics';doc.body.append(link);
 link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}

function calendarStamp(date){
 return date.toISOString().replace(/[-:]|\.\d{3}/g,'');
}
function calendarDetails(receipt){
 return (receipt.demo?'Demo appointment.\n':'')+'Booking reference: '+receipt.id;
}
