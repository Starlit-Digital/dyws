import {adminPage} from './admin-navigation.js?v=39';
import {escapeHTML as esc} from './api.js';
export function registerConnectorSettings(plugin,id){
 plugin.addAction('admin:settings',async({root,api})=>{
  const host=root.querySelector('[data-dyws-plugin-settings]');if(!host||host.querySelector('#plugin-'+id))return;
  const page=adminPage({root,api}),endpoint='/manager/plugins/'+id;let data=await page.request(endpoint+'/settings'),refresh;
  const section=plugin.document.createElement('section');section.id='plugin-'+id;host.append(section);
  section.innerHTML=`<h2>${esc(data.name)}</h2><p>${esc(data.notice)}</p><p data-connector-state role="status"></p><form><label>Environment<select name="environment"><option value="sandbox">Sandbox</option></select></label>${data.fields.map(f=>`<label>${esc(f.label)}<input type="password" name="${esc(f.id)}" autocomplete="off" spellcheck="false" placeholder="Leave blank to keep saved value"></label><label class="dyws-note"><input type="checkbox" data-clear="${esc(f.id)}"> Clear saved ${esc(f.label.toLowerCase())}</label>`).join('')}<div class="dyws-actions"><button type="submit">Save credentials</button><button type="button" data-verify class="dyws-secondary">Check connection</button></div></form><details><summary>Connector API and events</summary><p>Supported operations: ${data.operations.map(esc).join(', ')}.</p>${data.webhookUrl?`<p>Webhook URL</p><code>${esc(data.webhookUrl)}</code><p>Register this exact address in the sandbox provider dashboard. Connection checks do not test webhook delivery.</p>`:'<p>This provider uses authenticated server receipt retrieval instead of a webhook.</p>'}<a href="${esc(data.documentation)}" target="_blank" rel="noopener noreferrer">Provider documentation ↗</a></details><p data-connector-message role="status"></p>`;
  const form=section.querySelector('form'),message=section.querySelector('[data-connector-message]');
  function display(next){data=next;section.querySelector('[data-connector-state]').textContent=(data.configured?'Credentials saved. ':'Required credentials needed. ')+(data.verifiedAt?'Connection checked '+new Date(data.verifiedAt*1000).toLocaleString()+'.':'Connection not checked.');for(const f of data.fields)form.elements[f.id].placeholder=f.saved?'Saved. Leave blank to keep.':'Not saved';refresh?.reset(data);}
  display(data);
  form.onsubmit=e=>{e.preventDefault();page.action(e.submitter,async()=>{const credentials=Object.fromEntries(data.fields.map(f=>[f.id,form.elements[f.id].value]));const clear=[...form.querySelectorAll('[data-clear]:checked')].map(n=>n.dataset.clear);const next=await page.request(endpoint+'/settings',{method:'POST',body:{environment:'sandbox',credentials,clear,revision:data.revision}});form.reset();display(next);message.textContent='Credentials saved securely. Check the connection to verify them.';});};
  section.querySelector('[data-verify]').onclick=e=>page.action(e.currentTarget,async()=>{if(data.fields.some(f=>form.elements[f.id].value)||form.querySelector('[data-clear]:checked'))throw new Error('Save your credential changes before checking the connection.');const result=await page.request(endpoint+'/verify',{method:'POST',body:{}});display(await page.request(endpoint+'/settings'));message.textContent=result.detail;});
  refresh=page.autoRefresh({read:()=>page.request(endpoint+'/settings'),apply:display,forms:[form],initial:data});
  plugin.onDestroy(()=>{section.remove();});
  if(location.hash==='#plugin-'+id)section.scrollIntoView({block:'start'});
 });
}
