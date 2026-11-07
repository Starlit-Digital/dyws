import {periodStart} from './report-periods.js';
import {dateKey} from '../../dyws/date-time.js';
import {mountExportControls} from './export-controls.js';
import {mountPDFArchive} from './archive.js';

export function mountReportToolbar(root,{plugin,getReport,getToken,downloadPDF,refresh}){
 const doc=root.ownerDocument,from=root.querySelector('#from'),to=root.querySelector('#to'),refreshButton=root.querySelector('#refresh'),csv=root.querySelector('#export');
 const fromLabel=from.closest('label'),toLabel=to.closest('label');
 root.classList.add('dyws-report-workbench');root.replaceChildren();
 root.innerHTML='<div class="dyws-report-title-row"><div><h2>Reports</h2><p data-report-scope></p></div><details class="dyws-report-command-menu" data-export-menu><summary>Export <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></summary><div class="dyws-report-command-panel"><button type="button" class="dyws-secondary" data-overview>Download PDF</button><button type="button" class="dyws-secondary" data-save-archive>Save to archive</button><div data-archive-launch></div><div class="dyws-report-export-secondary"></div></div></details></div><div class="dyws-report-selection"><label class="dyws-report-period">Period<select data-period><option value="30">Last 30 days</option><option value="3m">Last 3 months</option><option value="6m">Last 6 months</option><option value="year">Last year</option><option value="7">Last 7 days</option><option value="1">Today</option><option value="month">This month</option><option value="custom">Custom dates</option></select></label><details class="dyws-report-command-menu" data-filter-menu><summary>Filters<span data-filter-count hidden></span></summary><div class="dyws-report-command-panel"><label>Currency<select data-currency><option value="">Store currency</option></select></label><label>Fulfillment<select data-fulfillment><option value="all">All orders</option><option value="pickup">Pickup</option><option value="delivery">Delivery</option></select></label></div></details><div class="dyws-report-custom-dates" hidden></div><div data-refresh-slot></div></div>';
 const titleRow=root.querySelector('.dyws-report-title-row'),selection=root.querySelector('.dyws-report-selection'),actions=doc.createElement('div');actions.className='dyws-report-toolbar-actions';
 const dateRow=selection.querySelector('.dyws-report-custom-dates'),exportCommand=root.querySelector('[data-export-menu]');
 for(const child of [...selection.children])if(child!==dateRow)actions.append(child);
 actions.append(exportCommand);titleRow.append(actions);selection.className='dyws-report-custom-row';
 const currency=root.querySelector('[data-currency]'),fulfillment=root.querySelector('[data-fulfillment]'),period=root.querySelector('[data-period]'),custom=root.querySelector('.dyws-report-custom-dates'),scope=root.querySelector('[data-report-scope]');
 custom.append(fromLabel,toLabel);root.querySelector('[data-refresh-slot]').append(refreshButton);refreshButton.classList.add('dyws-report-refresh');refreshButton.setAttribute('aria-label','Refresh reports');refreshButton.title='Refresh reports';refreshButton.innerHTML='<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M15.7 7A6 6 0 1 0 16 12M16 3v4h-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
 const secondary=root.querySelector('.dyws-report-export-secondary');
 csv.textContent='Download CSV';secondary.append(csv);mountExportControls(secondary,plugin.api,getReport,{getToken});mountPDFArchive(root.querySelector('[data-archive-launch]'),plugin.api,{getToken});
 root.querySelector('[data-overview]').onclick=event=>downloadPDF(event.currentTarget,'overview');
 root.querySelector('[data-save-archive]').onclick=event=>downloadPDF(event.currentTarget,'overview',{archiveOnly:true});
 const menus=[...root.querySelectorAll('.dyws-report-command-menu')];
 menus.forEach(menu=>menu.addEventListener('toggle',()=>{if(menu.open)menus.forEach(other=>{if(other!==menu)other.open=false;});}));
 doc.addEventListener('pointerdown',event=>{if(doc.querySelector('.dyws-pdf-dialog[open]'))return;menus.forEach(menu=>{if(!menu.contains(event.target))menu.open=false;});});
 root.addEventListener('keydown',event=>{if(event.key==='Escape'){const open=menus.find(menu=>menu.open);if(open){open.open=false;open.querySelector('summary').focus();event.stopPropagation();}}});
 const showDates=()=>{custom.hidden=period.value!=='custom';selection.hidden=custom.hidden;};
 from.addEventListener('change',()=>{period.value='custom';showDates();});to.addEventListener('change',()=>{period.value='custom';showDates();});
 period.onchange=()=>{showDates();if(period.value==='custom'){from.focus();return;}const today=dateKey();to.value=today;from.value=periodStart(today,period.value);refresh();};
 currency.onchange=fulfillment.onchange=()=>{refresh();};
 showDates();
 const format=value=>new Intl.DateTimeFormat('en-CA',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
 return {currency,fulfillment,update(data){scope.textContent=`${format(data.range.from)} to ${format(data.range.to)} · ${data.currency} · ${data.fulfillment==='all'?'All orders':data.fulfillment==='pickup'?'Pickup':'Delivery'}`;scope.title=data.timeZone;const count=(data.fulfillment!=='all'?1:0)+(data.currency!==(data.storeCurrency||data.currency)?1:0),badge=root.querySelector('[data-filter-count]');badge.hidden=!count;badge.textContent=count;}};
}
