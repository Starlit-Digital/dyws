export const weekDays=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
export function locationPolicy(catalog,location={}) {
 return Object.fromEntries(['locationHours','orderingHours','deliveryPricing'].map(key=>[key,location[key]??catalog[key]??null]));
}
export function deliveryCharge(catalog,subtotal,fulfillment,location={}) {
 if(fulfillment!=='delivery')return 0;
 const pricing=locationPolicy(catalog,location).deliveryPricing??{flatFee:catalog.deliveryFee??395,basisPoints:catalog.deliveryFeeBasisPoints??0};
 return pricing.flatFee+Math.floor((subtotal*pricing.basisPoints+5000)/10000);
}
export function isOrderingOpen(schedule,timeZone='America/Edmonton',at=new Date()) {
 if(!schedule?.enabled)return true;
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone,weekday:'long',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(at).map(p=>[p.type,p.value]));
 const index=weekDays.indexOf(parts.weekday),time=parts.hour+':'+parts.minute,day=schedule.days[index],previous=schedule.days[(index+6)%7];
 if(previous.mode==='hours'&&previous.close<previous.open&&time<previous.close)return true;
 return day.mode==='allDay'||(day.mode==='hours'&&(day.close<day.open?time>=day.open:time>=day.open&&time<day.close));
}
export function scheduleText(schedule) {
 if(!schedule?.enabled)return '';
 return schedule.days.map((day,i)=>`${weekDays[i]}: ${day.mode==='closed'?'Closed':day.mode==='allDay'?'24 hours':day.open+' to '+day.close+(day.close<day.open?' next day':'')}`).join(' · ');
}
