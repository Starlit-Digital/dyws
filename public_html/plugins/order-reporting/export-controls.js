import {escapeHTML as esc} from '../../dyws/api.js';
import {download} from './charts.js';

export function mountExportControls(root,api,getReport) {
 const box=root.ownerDocument.createElement('details');box.className='dyws-report-export';
 box.innerHTML='<summary>Export or email a report</summary><fieldset><legend>Include sections</legend>'+[['overview','KPI overview'],['daily','Daily trend'],['items','Products'],['locations','Locations'],['operations','Order flow and busy hours']].map(([value,label])=>`<label class="dyws-checkbox"><input type="checkbox" value="${value}" checked> ${label}</label>`).join('')+'</fieldset><label>Format<select data-format><option value="pdf">PDF</option><option value="csv">CSV</option><option value="txt">Text</option></select></label><div class="dyws-actions"><button type="button" data-download>Download report</button><button type="button" class="dyws-secondary" data-email disabled>Email me</button></div><p data-email-state class="dyws-note">Checking email availability…</p><p role="status" data-export-status></p>';
 root.append(box);const status=box.querySelector('[data-export-status]'),email=box.querySelector('[data-email]');let busy=false,emailOptions=null,attempt=null;
 const request=(route,options={})=>api('/manager/plugins/order-reporting/'+route,{...options,token:sessionStorage.getItem('dyws-manager')});
 const availability=async()=>{const result=await request('export-options');emailOptions=result.email;email.disabled=!emailOptions.enabled;box.querySelector('[data-email-state]').textContent=(emailOptions.recipient?'To: '+emailOptions.recipient+'. ':'')+emailOptions.reason;};
 void availability().catch(e=>{box.querySelector('[data-email-state]').textContent=e.message;});
 async function perform(send){
  if(busy)return;const report=getReport();if(!report){status.textContent='Load a report first.';return;}
  const sections=[...box.querySelectorAll('input:checked')].map(input=>input.value);if(!sections.length){status.textContent='Choose at least one report section.';return;}
  const body={format:box.querySelector('[data-format]').value,sections,query:{from:report.range.from,to:report.range.to,currency:report.currency,fulfillment:report.fulfillment}};
  busy=true;box.querySelectorAll('button').forEach(button=>button.disabled=true);status.textContent=send?'Preparing your email…':'Preparing your report…';
  try{
   if(send){
    // Reuse the key after an uncertain network result, so a retry cannot send twice.
    const fingerprint=JSON.stringify(body);if(attempt?.fingerprint!==fingerprint)attempt={fingerprint,key:crypto.randomUUID()};
    const result=await request('email',{method:'POST',body:{...body,idempotencyKey:attempt.key}});status.textContent=result.message;attempt=null;
   }else{
    const result=await request('export',{method:'POST',body});const bytes=Uint8Array.from(atob(result.content),c=>c.charCodeAt(0));download(bytes,result.type,result.name,root.ownerDocument);status.textContent='Your report is ready.';
   }
  }catch(error){status.textContent=error.message||'The request could not finish. Your report selections have been kept.';}
  finally{busy=false;box.querySelector('[data-download]').disabled=false;email.disabled=!emailOptions?.enabled;}
 }
 box.querySelector('[data-download]').onclick=()=>perform(false);email.onclick=()=>perform(true);
}
