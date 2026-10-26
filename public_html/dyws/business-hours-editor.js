import {weekDays} from './business-policy.js';
import {escapeHTML as esc} from './api.js';

export function mountHoursEditor(root,{label,schedule=null,inherit=false}) {
 const days=schedule?.days??weekDays.map(()=>({mode:'closed',open:'09:00',close:'17:00'}));
 root.classList.add('dyws-hours-editor');
 root.innerHTML=`<details><summary>${esc(label)}</summary><label>Schedule<select data-hours-mode>${inherit?'<option value="inherit">Use business default</option>':''}<option value="none">${label==='Ordering hours'?'Accept orders at any time':'Hours not published'}</option><option value="custom">Set weekly hours</option></select></label><div data-hours-days>${days.map((day,i)=>`<div class="dyws-hours-day"><strong>${weekDays[i]}</strong><label><span class="dyws-visually-hidden">${weekDays[i]} availability</span><select data-day-mode><option value="closed">Closed</option><option value="hours">Set hours</option><option value="allDay">24 hours</option></select></label><label>Opens<input type="time" data-day-open required value="${esc(day.open)}" aria-label="${weekDays[i]} opens"></label><label>Closes<input type="time" data-day-close required value="${esc(day.close)}" aria-label="${weekDays[i]} closes"></label></div>`).join('')}</div><p class="dyws-note">Times use the timezone saved under General. A closing time earlier than opening continues into the next day. Closing times stop new orders; they do not cancel existing orders.</p></details>`;
 const mode=root.querySelector('[data-hours-mode]');mode.value=schedule?(schedule.enabled?'custom':'none'):(inherit?'inherit':'none');
 const rows=[...root.querySelectorAll('.dyws-hours-day')];rows.forEach((row,i)=>row.querySelector('select').value=days[i].mode);
 const sync=()=>{
  const custom=mode.value==='custom';root.querySelector('[data-hours-days]').hidden=!custom;
  for(const row of rows){const select=row.querySelector('select');select.disabled=!custom;for(const input of row.querySelectorAll('input'))input.disabled=!custom||select.value!=='hours';}
 };
 root.addEventListener('change',sync);sync();
 return ()=>mode.value==='inherit'?null:{enabled:mode.value==='custom',days:rows.map(row=>({mode:row.querySelector('select').value,open:row.querySelector('[data-day-open]').value||'09:00',close:row.querySelector('[data-day-close]').value||'17:00'}))};
}
