import {escapeHTML as esc} from '../../dyws/api.js';

const targets=[['','All reports'],['overview','Overview'],['report','Custom report'],['at-a-glance','Operational summary'],['all-items','All items'],['daily','Daily data'],['payments','Payment breakdown'],['hours','Order times'],['payment-trend','Payment trend'],['orders-by-day','Orders by day'],['demand','Demand'],['top-items','Popular items'],['order-flow','Order flow'],['locations','Locations'],['fulfillment','Fulfillment times']];
const title=row=>targets.find(([value])=>value===row.target)?.[1]||row.target;
export function archiveGroups(rows){
 const groups=new Map();
 for(const row of rows){const year=row.created_at.slice(0,4),month=row.created_at.slice(5,7);if(!groups.has(year))groups.set(year,new Map());const months=groups.get(year);if(!months.has(month))months.set(month,[]);months.get(month).push(row);}
 return [...groups].sort(([a],[b])=>b.localeCompare(a)).map(([year,months])=>({year,months:[...months].sort(([a],[b])=>b.localeCompare(a)).map(([month,items])=>({month,items:items.sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)||b.id.localeCompare(a.id))}))}));
}
export function mountPDFArchive(root,api,{getToken=()=>null}={}) {
 const doc=root.ownerDocument,box=doc.createElement('div');box.className='dyws-archive-launcher';
 box.innerHTML='<button type="button" class="dyws-secondary" data-open-archive>Open archive</button>';
 const dialog=doc.createElement('dialog');dialog.className='dyws-pdf-dialog';dialog.setAttribute('aria-labelledby','pdf-archive-title');
 dialog.innerHTML=`<header class="dyws-pdf-dialog-header"><h2 id="pdf-archive-title">PDF archive</h2><button type="button" class="dyws-secondary" data-toggle-rail aria-controls="pdf-archive-list" aria-expanded="true">PDFs</button><form data-archive-search><button type="submit" hidden>Search</button><input name="q" type="search" aria-label="Search archived PDFs" placeholder="Search PDFs" autocomplete="off"><details class="dyws-pdf-filters"><summary>Filters</summary><div class="dyws-pdf-filter-popover"><label>Report<select name="target">${targets.map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label><label>Period from<input name="from" type="date"></label><label>Period to<input name="to" type="date"></label><label>Currency<input name="currency" placeholder="CAD" maxlength="3"></label><label>Fulfillment<select name="fulfillment"><option value="">Any</option><option value="all">All orders</option><option value="pickup">Pickup</option><option value="delivery">Delivery</option></select></label><button type="reset" class="dyws-secondary">Clear filters</button></div></details></form><span data-preview-heading>Select a PDF</span><div data-viewer-controls></div><div data-pdf-tools class="dyws-actions"></div><span role="status" data-archive-status></span><button type="button" class="dyws-secondary" data-more hidden>Load more</button><span role="status" data-preview-status></span><button type="button" class="dyws-secondary" data-close-archive aria-label="Close PDF archive">Close</button></header><div class="dyws-pdf-workspace"><aside id="pdf-archive-list" class="dyws-pdf-rail" aria-label="Archived PDFs"><nav data-archive-results aria-label="PDFs by year and month"></nav></aside><section class="dyws-pdf-preview" aria-label="PDF preview"><div data-preview-frame class="dyws-pdf-frame"></div></section></div>`;
 doc.body.append(dialog);root.append(box);
 const form=dialog.querySelector('form'),status=dialog.querySelector('[data-archive-status]'),results=dialog.querySelector('[data-archive-results]'),more=dialog.querySelector('[data-more]'),heading=dialog.querySelector('[data-preview-heading]'),previewStatus=dialog.querySelector('[data-preview-status]'),frame=dialog.querySelector('[data-preview-frame]'),opener=box.querySelector('[data-open-archive]'),tools=dialog.querySelector('[data-pdf-tools]'),viewerControls=dialog.querySelector('[data-viewer-controls]'),railToggle=dialog.querySelector('[data-toggle-rail]');
 let rows=[],selected=null,objectURL=null,viewer=null,searchVersion=0,previewVersion=0,timer=null,controller=null;
 const request=(route,options={})=>api('/manager/plugins/order-reporting/'+route,{...options,token:getToken()});
 const clearPreview=()=>{previewVersion++;viewer?.destroy();viewer=null;frame.replaceChildren();if(objectURL)URL.revokeObjectURL(objectURL);objectURL=null;selected=null;heading.textContent='Select a PDF';heading.removeAttribute('title');tools.replaceChildren();viewerControls.replaceChildren();previewStatus.textContent='';};
 function renderList(){
  results.innerHTML=archiveGroups(rows).map(group=>`<section class="dyws-pdf-year"><h3>${esc(group.year)}</h3>${group.months.map(month=>`<section><h4>${new Intl.DateTimeFormat('en-CA',{month:'long',timeZone:'UTC'}).format(new Date(`${group.year}-${month.month}-01T00:00:00Z`))}</h4><ul>${month.items.map(row=>`<li><button type="button" class="dyws-pdf-file" data-pdf-id="${esc(row.id)}"${row.id===selected?' aria-current="true"':''}><strong>${esc(title(row))}</strong><span>${esc(row.date_from)} to ${esc(row.date_to)}</span><small>${esc(row.currency)} · ${esc(row.fulfillment)}<br>${esc(row.reference)}</small></button></li>`).join('')}</ul></section>`).join('')}</section>`).join('');
  results.querySelectorAll('[data-pdf-id]').forEach(button=>button.onclick=()=>void selectPDF(rows.find(row=>row.id===button.dataset.pdfId)));
 }
 async function selectPDF(row){
  if(!row)return;clearPreview();selected=row.id;const version=previewVersion;
  results.querySelectorAll('[data-pdf-id]').forEach(button=>{if(button.dataset.pdfId===selected)button.setAttribute('aria-current','true');else button.removeAttribute('aria-current');});
  heading.textContent=title(row);heading.title=`${row.date_from} to ${row.date_to} · ${row.currency} · ${row.fulfillment} · ${row.reference}`;
  previewStatus.textContent='Loading PDF…';
  try{
   const file=await request('archive/download',{method:'POST',body:{id:row.id},timeoutMs:30000});if(version!==previewVersion||!dialog.open)return;
   const bytes=Uint8Array.from(atob(file.content),c=>c.charCodeAt(0));objectURL=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
   for(const [label,newTab] of [['Download PDF',false],['Open in tab',true]]){const link=doc.createElement('a');link.className='dyws-secondary';link.textContent=label;link.href=objectURL;if(newTab){link.target='_blank';link.rel='noopener';}else link.download=file.name;tools.append(link);}
   const {createPDFViewer}=await import('./pdf-viewer.js');if(version!==previewVersion||!dialog.open)return;viewer=createPDFViewer(frame,bytes,title(row),viewerControls);previewStatus.textContent='';await viewer.ready;
  }catch(error){if(version!==previewVersion||!dialog.open)return;previewStatus.textContent=(error.message||'PDF unavailable.')+' Select the PDF to retry.';}
 }
 async function search(append=false){
  clearTimeout(timer);controller?.abort();controller=new AbortController();const version=++searchVersion;status.textContent='Loading…';more.disabled=true;
  if(!append){rows=[];renderList();clearPreview();}
  try{
   const query=new URLSearchParams(new FormData(form));query.set('currency',query.get('currency').trim().toUpperCase());query.set('offset',String(append?rows.length:0));
   const data=await request('archive?'+query,{signal:controller.signal});if(version!==searchVersion||!dialog.open)return;
   rows=append?[...rows,...data.items]:data.items;renderList();status.textContent=data.total?`${rows.length} of ${data.total} PDFs`:'No PDFs found.';more.hidden=rows.length>=data.total;
   if(!append&&rows.length)void selectPDF(rows[0]);
  }catch(error){if(version===searchVersion&&dialog.open){status.textContent=error.message||'Archive unavailable. Search again to retry.';more.hidden=true;}}
  finally{if(version===searchVersion)more.disabled=false;}
 }
 railToggle.onclick=()=>{const open=dialog.dataset.railOpen!=='true';dialog.dataset.railOpen=String(open);railToggle.setAttribute('aria-expanded',String(open));};
 opener.onclick=()=>{const open=window.matchMedia('(min-width:701px)').matches;dialog.dataset.railOpen=String(open);railToggle.setAttribute('aria-expanded',String(open));dialog.showModal();form.elements.q.focus();void search();};
 dialog.querySelector('[data-close-archive]').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{clearTimeout(timer);controller?.abort();searchVersion++;clearPreview();opener.focus();});
 form.onsubmit=event=>{event.preventDefault();void search();};
 form.elements.q.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>void search(),250);});
 form.addEventListener('change',event=>{if(event.target!==form.elements.q)void search();});
 form.onreset=()=>setTimeout(()=>void search(),0);more.onclick=()=>void search(true);
}
