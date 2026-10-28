import {api} from '../../platform/api.js';
import {plugins} from '../../platform/plugins.js?v=39';
import {mountNavigation} from '../../platform/admin-navigation.js?v=39';
import {adminPage} from '../../dyws/admin-navigation.js?v=39';
import {markReady} from '../../dyws/diagnostics.js';
import {escapeHTML as esc} from '../../dyws/api.js';
import {clone,starterLayout,firstSpace,placeField,insertRow,removeRow,removeField,occupied} from './model.js';

await mountNavigation('order-forms');
const page=adminPage({root:document.body,api}),root=document.querySelector('[data-format-editor]');
const endpoint='/manager/plugins/order-format/templates',locked=document.body.dataset.orderFormatLocked==='true';
let data,draft,savedId=null,selected=null,pending=null,dirty=false,busy=false,preview=false,phonePreview=false,dragged=null,history=[];
const announce=message=>{root.querySelector('[data-format-status]').textContent=message;};
const stage=()=>data.schema[draft.stage];
const definition=id=>stage().fields.find(field=>field.id===id);
const field=id=>draft.layout.fields.find(item=>item.id===id);
function changed(){dirty=true;root.querySelector('[data-format-dirty]').textContent='Unsaved changes';}
function remember(){history.push(clone(draft));if(history.length>40)history.shift();}
function edit(fn){if(busy)return false;try{remember();fn();changed();renderCanvas();renderProperties();renderPalette();return true;}catch(error){history.pop();renderProperties();announce(error.message);return false;}}
function newDraft(stageId='cart'){
 draft={id:crypto.randomUUID(),name:data.schema[stageId].label+' layout',stage:stageId,layout:starterLayout(data.schema[stageId])};savedId=null;selected=null;pending=null;history=[];dirty=false;
}
function syncToolbar(){
 root.querySelector('[data-template-name]').value=draft.name;root.querySelector('[data-template-stage]').value=draft.stage;
 const select=root.querySelector('[data-template-select]');select.innerHTML='<option value="">New template</option>'+data.templates.map(t=>`<option value="${esc(t.id)}">${esc(t.name)} · ${esc(data.schema[t.stage].label)}</option>`).join('');select.value=savedId||'';
 root.querySelector('[data-format-dirty]').textContent=dirty?'Unsaved changes':savedId?(data.assignments[draft.stage]===savedId?'Used for this stage':'Saved draft'):'New template';
 root.querySelector('[data-delete-template]').disabled=!savedId||locked;renderAssignments();
}
function render(){
 root.innerHTML=`${locked?'<p class="dyws-format-banner">Template saving is locked on this public demo. You can explore the editor and preview layouts here.</p>':''}<div class="dyws-format-toolbar"><label>Template<select data-template-select></select></label><label>Template name<input data-template-name maxlength="80" required></label><label>Stage<select data-template-stage>${Object.entries(data.schema).map(([key,s])=>`<option value="${key}">${esc(s.label)}</option>`).join('')}</select></label><div class="dyws-format-buttons"><button type="button" class="dyws-secondary" data-new-template>New</button><button type="button" class="dyws-secondary" data-duplicate-template>Duplicate</button><button type="button" data-save-template ${locked?'disabled':''}>Save template</button></div></div><div class="dyws-format-subbar"><span data-format-dirty></span><div><button class="dyws-secondary" type="button" data-reload>Reload saved</button><button class="dyws-secondary" type="button" data-delete-template>Delete template</button></div></div><div class="dyws-format-workspace"><aside class="dyws-format-rail" aria-label="Available fields"><h2>Fields</h2><p>Drag onto a cell, or select a field and click an empty cell.</p><div data-field-palette></div></aside><section class="dyws-format-center" aria-label="Layout canvas"><div class="dyws-format-canvas-toolbar"><div class="dyws-format-segment"><button type="button" data-design aria-pressed="${!preview}">Layout</button><button type="button" data-preview aria-pressed="${preview}">Preview</button></div><div class="dyws-format-segment"><button type="button" data-desktop aria-pressed="${!phonePreview}">Desktop</button><button type="button" data-phone aria-pressed="${phonePreview}">Phone</button></div></div><div class="dyws-format-canvas-shell"><div data-layout-canvas></div></div><div class="dyws-format-canvas-actions"><button type="button" class="dyws-secondary" data-add-row>+ Add row</button><button type="button" class="dyws-secondary" data-undo>Undo</button><span data-row-count></span></div></section><aside class="dyws-format-rail" aria-label="Layout options"><h2>Layout</h2><div data-field-properties></div><div class="dyws-format-assignments"><h2>Stage templates</h2><p>Choose a saved template, or keep the built in layout.</p><div data-stage-assignments></div></div></aside></div><p class="dyws-format-status" data-format-status role="status" aria-live="polite"></p><dialog class="dyws-format-dialog" data-discard-dialog><h2>Keep your changes?</h2><p>This template has unsaved changes.</p><div class="dyws-actions"><button type="button" data-keep-editing>Keep editing</button><button type="button" class="dyws-secondary" data-discard>Discard changes</button></div></dialog>`;
 syncToolbar();renderPalette();renderCanvas();renderProperties();bindToolbar();
}
function renderPalette(){
 root.querySelector('[data-field-palette]').innerHTML=stage().fields.map(f=>`<button type="button" draggable="true" data-palette-field="${f.id}" aria-pressed="${pending===f.id}" class="${field(f.id)?'dyws-field-used':''}"><span aria-hidden="true">⠿</span><span>${esc(f.label)}${f.required?'<small>Essential</small>':''}</span><span aria-hidden="true">${field(f.id)?'✓':'+'}</span></button>`).join('');
 for(const button of root.querySelectorAll('[data-palette-field]')){
  button.onclick=()=>{selected=field(button.dataset.paletteField)?.id||null;pending=selected?null:button.dataset.paletteField;renderPalette();renderProperties();renderCanvas();announce(selected?'Field selected. Adjust it in the layout rail.':'Choose an empty cell, or use Add to first space.');};
  button.ondragstart=e=>{dragged=button.dataset.paletteField;e.dataTransfer.setData('text/plain',dragged);e.dataTransfer.effectAllowed='move';};button.ondragend=()=>{dragged=null;root.querySelectorAll('.dyws-drop-active').forEach(node=>node.classList.remove('dyws-drop-active'));};
 }
}
const sample={name:'Demo Customer',phone:'(780) 555-0142',email:'demo.customer@example.test',address:'123 Example Avenue NW',postal:'T5A 1A1',notes:'Please include napkins.',pickup:'15321 Starlit Lane NW'};
function fieldPreview(f){
 const info=definition(f.id);if(info.kind==='items')return '<div class="dyws-preview-items"><div><span>1 × Diner Omelette</span><b>$13.95</b></div><div><span>1 × Buttermilk Pancakes</span><b>$11.95</b></div></div>';
 if(info.kind==='total')return '<strong class="dyws-preview-total">Total '+(draft.stage==='cart'?'$27.20':'$31.34')+'</strong>';
 if(info.kind==='amount')return `<div class="dyws-preview-amount"><span>${esc(info.label)}</span><b>${({subtotal:'$25.90',tax:draft.stage==='cart'?'$1.30':'$1.49',delivery:'$3.95'})[f.id]||'$0.00'}</b></div>`;
 if(info.kind==='input'||info.kind==='textarea')return `<div class="dyws-preview-label">${esc(info.label)}${info.required?'':' <small>optional</small>'}<div class="dyws-preview-input ${info.kind==='textarea'?'dyws-preview-textarea':''}">${esc(({name:'Demo Customer',phone:'(780) 555-0142',email:'demo.customer@example.test',street:'123 Example Avenue NW',unit:'Unit 4',postal:'T5A 1A1',city:'Edmonton',region:'AB',country:'Canada',notes:''})[f.id]||'')}</div></div>`;
 if(info.kind==='fulfillment')return '<div class="dyws-preview-label">Order type<div class="dyws-preview-pills"><span>Pickup</span><strong>✓ Delivery</strong></div></div>';
 if(info.kind==='actions')return draft.stage==='cart'?'<span class="dyws-preview-button">Checkout</span>':`<div class="dyws-preview-actions"><span class="dyws-preview-button dyws-preview-muted">Back</span><span class="dyws-preview-button">${draft.stage==='checkout'?'Review':'Place order'}</span></div>`;
 if(info.kind==='pause')return '<span class="dyws-preview-button dyws-preview-muted">Take more time</span>';
 return `<span>${esc(sample[f.id]||info.label)}</span>`;
}
function renderCanvas(){
 const canvas=root.querySelector('[data-layout-canvas]');canvas.className='dyws-format-canvas'+(preview?' dyws-format-preview':'')+(phonePreview?' dyws-format-phone':'');
 let content='<div class="dyws-format-preview-brand"><span>✦ Starlit Diner</span><span>Close</span></div>';
 for(let row=1;row<=draft.layout.rows;row++){
  content+=`<div class="dyws-format-row" data-layout-row="${row}">${preview?'':`<div class="dyws-format-row-label"><span>Row ${row}</span><button type="button" data-insert-row="${row}" aria-label="Insert above row ${row}">+</button><button type="button" data-remove-row="${row}" aria-label="Remove empty row ${row}" ${draft.layout.fields.some(f=>f.row===row)||draft.layout.rows===1?'disabled':''}>−</button></div>`}<div class="dyws-format-cells">`;
  for(let column=1;column<=2;column++){
   const item=occupied(draft.layout,row,column);if(item&&item.column!==column)continue;
   if(item){content+=`<div class="dyws-format-block ${selected===item.id?'dyws-format-selected':''}" data-block="${item.id}" data-row="${row}" data-column="${column}" data-span="${item.span}" data-align="${item.align}" data-vertical="${item.vertical}" draggable="${!preview}" tabindex="${preview?-1:0}" role="button" aria-label="${esc(definition(item.id).label)}, row ${row}, column ${column}${item.span===2?', spans both columns':''}" aria-pressed="${selected===item.id}">${preview?'':`<small class="dyws-format-block-label">⠿ ${esc(definition(item.id).label)}</small>`}${fieldPreview(item)}</div>`;}
   else content+=preview?'<div class="dyws-format-preview-empty"></div>':`<button type="button" class="dyws-format-drop" data-drop-row="${row}" data-drop-column="${column}" aria-label="Place field in row ${row}, column ${column}"><span aria-hidden="true">+</span><small>Drop field</small></button>`;
  }
  content+='</div></div>';
 }
 canvas.innerHTML=content;root.querySelector('[data-row-count]').textContent=draft.layout.rows+' rows · 2 columns';root.querySelector('[data-undo]').disabled=!history.length;root.querySelector('[data-add-row]').disabled=draft.layout.rows>=30||preview;
 for(const node of canvas.querySelectorAll('[data-block]')){
  node.onclick=()=>{if(preview||busy)return;selected=node.dataset.block;pending=null;renderCanvas();renderPalette();renderProperties();};
  node.onkeydown=e=>{if(!preview&&!busy&&['Enter',' '].includes(e.key)){e.preventDefault();node.click();root.querySelector('[data-field-row]')?.focus();}};
  node.ondragstart=e=>{if(preview||busy){e.preventDefault();return;}dragged=node.dataset.block;e.dataTransfer.setData('text/plain',dragged);e.dataTransfer.effectAllowed='move';};node.ondragend=()=>{dragged=null;};
 }
 for(const node of canvas.querySelectorAll('[data-drop-row],[data-block]')){
  node.ondragover=e=>{if(preview||busy||!dragged)return;e.preventDefault();e.dataTransfer.dropEffect='move';node.classList.add('dyws-drop-active');};node.ondragleave=()=>node.classList.remove('dyws-drop-active');
  node.ondrop=e=>{e.preventDefault();node.classList.remove('dyws-drop-active');const id=dragged;dragged=null;if(!id||!definition(id))return;place(id,Number(node.dataset.dropRow||node.dataset.row),Number(node.dataset.dropColumn||node.dataset.column));};
  if(node.dataset.dropRow)node.onclick=()=>{if(pending||selected)place(pending||selected,Number(node.dataset.dropRow),Number(node.dataset.dropColumn));else announce('Select a field in the left rail first.');};
 }
 canvas.querySelectorAll('[data-insert-row]').forEach(b=>b.onclick=()=>edit(()=>draft.layout=insertRow(draft.layout,Number(b.dataset.insertRow))));
 canvas.querySelectorAll('[data-remove-row]').forEach(b=>b.onclick=()=>edit(()=>draft.layout=removeRow(draft.layout,Number(b.dataset.removeRow))));
}
function place(id,row,column,patch={}){
 if(edit(()=>{const info=definition(id),current=field(id)||{id,span:info.span,align:info.align||'left',vertical:'top'};draft.layout=placeField(draft.layout,{...current,...patch},row,column);selected=id;pending=null;}))announce(definition(id).label+' placed in row '+field(id).row+', '+(field(id).span===2?'both columns.':'column '+field(id).column+'.'));
}
function renderProperties(){
 const host=root.querySelector('[data-field-properties]'),current=field(selected),info=definition(selected||pending);
 if(!info){host.innerHTML='<p class="dyws-format-empty-help">Select a field on the canvas to change its position, span or alignment.</p>';return;}
 if(!current){host.innerHTML=`<h3>${esc(info.label)}</h3><p>Choose a canvas cell, or add this field to the next available space.</p><button type="button" data-add-field>Add to first space</button>`;host.querySelector('button').onclick=()=>{try{const spot=firstSpace(draft.layout,info.span);place(info.id,spot.row,spot.column);}catch(e){announce(e.message);}};return;}
 host.innerHTML=`<h3>${esc(info.label)}</h3>${info.required?'<p class="dyws-format-essential">Essential field</p>':''}<div class="dyws-format-prop-grid"><label>Row<input type="number" min="1" max="30" value="${current.row}" data-field-row></label><label>Column<select data-field-column ${current.span===2?'disabled':''}><option value="1">Left</option><option value="2">Right</option></select></label></div><label>Column span<select data-field-span ${current.id==='actions'?'disabled':''}><option value="1">One column</option><option value="2">Both columns</option></select></label><label>Horizontal alignment<select data-field-align><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label><label>Vertical alignment<select data-field-vertical><option value="top">Top</option><option value="center">Middle</option><option value="bottom">Bottom</option></select></label><button type="button" class="dyws-secondary" data-remove-field ${info.required?'disabled':''}>Remove field</button>`;
 for(const [key,value]of Object.entries({column:current.column,span:current.span,align:current.align,vertical:current.vertical}))host.querySelector('[data-field-'+key+']').value=value;
 host.querySelector('[data-field-row]').onchange=e=>place(current.id,Number(e.target.value),current.column);
 host.querySelector('[data-field-column]').onchange=e=>place(current.id,current.row,Number(e.target.value));
 host.querySelector('[data-field-span]').onchange=e=>place(current.id,current.row,current.column,{span:Number(e.target.value)});
 for(const key of ['align','vertical'])host.querySelector('[data-field-'+key+']').onchange=e=>place(current.id,current.row,current.column,{[key]:e.target.value});
 host.querySelector('[data-remove-field]').onclick=()=>edit(()=>{draft.layout=removeField(draft.layout,current.id,info);selected=null;});
}
function renderAssignments(){
 const host=root.querySelector('[data-stage-assignments]');host.innerHTML=Object.entries(data.schema).map(([id,s])=>`<label>${esc(s.label)}<select data-assignment="${id}" ${locked?'disabled':''}><option value="">Built in default</option>${data.templates.filter(t=>t.stage===id).map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select></label>`).join('')+'<button type="button" data-apply-assignments '+(locked?'disabled':'')+'>Apply stage templates</button>';
 for(const select of host.querySelectorAll('[data-assignment]'))select.value=data.assignments[select.dataset.assignment]||'';
 host.querySelector('button').onclick=()=>saveAssignments();
}
function guard(fn){
 if(!dirty){fn();return;}
 const dialog=root.querySelector('[data-discard-dialog]');dialog.showModal();dialog.querySelector('[data-keep-editing]').onclick=()=>dialog.close();dialog.querySelector('[data-discard]').onclick=()=>{dialog.close();fn();};
}
async function persist(next,message){
 if(busy||locked)return false;busy=true;const controls=[...root.querySelectorAll('button,input,select')].map(node=>[node,node.disabled]);controls.forEach(([node])=>node.disabled=true);root.setAttribute('aria-busy','true');
 try{data=await page.request(endpoint,{method:'POST',body:{templates:next.templates,assignments:next.assignments,revision:data.revision}});syncToolbar();announce(message);return true;}
 catch(e){announce(e.message);page.error.textContent=e.message;return false;}
 finally{busy=false;controls.forEach(([node,disabled])=>{if(node.isConnected)node.disabled=disabled;});root.removeAttribute('aria-busy');syncToolbar();}
}
async function save(){
 if(!draft.name.trim()){announce('Give this template a name.');root.querySelector('[data-template-name]').focus();return;}
 const next=clone(data);draft.name=draft.name.trim();next.templates=next.templates.filter(t=>t.id!==draft.id);next.templates.push(clone(draft));
 for(const key of Object.keys(next.assignments))if(next.assignments[key]===draft.id&&key!==draft.stage)next.assignments[key]=null;
 if(await persist(next,next.assignments[draft.stage]===draft.id?'Template saved. This stage will use the updated layout on the next page load.':'Template saved. Choose it under Stage templates to use it.')){savedId=draft.id;dirty=false;syncToolbar();}
}
async function saveAssignments(){
 const next=clone(data);for(const select of root.querySelectorAll('[data-assignment]'))next.assignments[select.dataset.assignment]=select.value||null;
 await persist(next,'Stage templates applied. New order flows will use these layouts.');
}
function bindToolbar(){
 root.querySelector('[data-template-name]').oninput=e=>{draft.name=e.target.value;changed();};
 root.querySelector('[data-template-select]').onchange=e=>{const id=e.target.value;e.target.value=savedId||'';guard(()=>{if(id){draft=clone(data.templates.find(t=>t.id===id));savedId=id;}else newDraft(draft.stage);dirty=false;selected=null;pending=null;history=[];render();});};
 root.querySelector('[data-template-stage]').onchange=e=>{const target=e.target.value;e.target.value=draft.stage;guard(()=>{if(draft.name===stage().label+' layout')draft.name=data.schema[target].label+' layout';draft.stage=target;draft.layout=starterLayout(data.schema[target]);selected=null;pending=null;history=[];changed();render();});};
 root.querySelector('[data-new-template]').onclick=()=>guard(()=>{newDraft(draft.stage);render();});
 root.querySelector('[data-duplicate-template]').onclick=()=>{draft={...clone(draft),id:crypto.randomUUID(),name:(draft.name+' copy').slice(0,80)};savedId=null;history=[];dirty=true;render();};
 root.querySelector('[data-save-template]').onclick=save;
 root.querySelector('[data-delete-template]').onclick=()=>guard(async()=>{const next=clone(data);next.templates=next.templates.filter(t=>t.id!==savedId);for(const key of Object.keys(next.assignments))if(next.assignments[key]===savedId)next.assignments[key]=null;if(await persist(next,'Template deleted. Any attached stage now uses its built in default.')){newDraft(draft.stage);render();}});
 root.querySelector('[data-reload]').onclick=()=>guard(async()=>{try{data=await page.request(endpoint);if(savedId&&data.templates.some(t=>t.id===savedId))draft=clone(data.templates.find(t=>t.id===savedId));else newDraft(draft.stage);dirty=false;history=[];render();announce('Saved templates reloaded.');}catch(e){announce(e.message);}});
 root.querySelector('[data-add-row]').onclick=()=>edit(()=>draft.layout=insertRow(draft.layout,draft.layout.rows+1));
 root.querySelector('[data-undo]').onclick=()=>{if(!history.length)return;draft=history.pop();selected=null;pending=null;changed();syncToolbar();renderPalette();renderCanvas();renderProperties();};
 const mode=(value)=>{preview=value;root.querySelector('[data-design]').setAttribute('aria-pressed',String(!value));root.querySelector('[data-preview]').setAttribute('aria-pressed',String(value));renderCanvas();};
 root.querySelector('[data-design]').onclick=()=>mode(false);root.querySelector('[data-preview]').onclick=()=>mode(true);
 const device=value=>{phonePreview=value;root.querySelector('[data-desktop]').setAttribute('aria-pressed',String(!value));root.querySelector('[data-phone]').setAttribute('aria-pressed',String(value));renderCanvas();};
 root.querySelector('[data-desktop]').onclick=()=>device(false);root.querySelector('[data-phone]').onclick=()=>device(true);
}
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
if(document.body.dataset.orderFormatActive!=='true')root.innerHTML='<p>Activate Order Format in Plugins to edit templates. The built in order layouts are currently in use.</p><a class="dyws-link-button" href="../../plugins/">Open Plugins</a>';
else try{data=await page.request(endpoint);newDraft();render();}catch(error){page.error.textContent=error.message;}
markReady();
