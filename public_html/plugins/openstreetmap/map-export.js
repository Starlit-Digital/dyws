import {captureMapPanels} from './map-preferences.js';
import {mountPDFArchive} from '../order-reporting/archive.js';
import {download} from '../order-reporting/charts.js';
export function mountMapExport(form,{api,getToken,getMap,getData,getLayers,getHeatmap,applyFilters,status}){
 const doc=form.ownerDocument,menu=doc.createElement('details');menu.className='dyws-report-command-menu dyws-osm-export';menu.innerHTML='<summary>Export <span aria-hidden="true">⌄</span></summary><div class="dyws-report-command-panel"><button type="button" class="dyws-secondary" data-map-download>Download PDF</button><button type="button" class="dyws-secondary" data-map-save>Save to archive</button><div data-map-archive></div></div>';form.append(menu);
 mountPDFArchive(menu.querySelector('[data-map-archive]'),api,{getToken});const dialogs=doc.querySelectorAll('.dyws-pdf-dialog');dialogs[dialogs.length-1]?.addEventListener('close',()=>menu.querySelector('summary').focus());const archive=menu.querySelector('[data-open-archive]'),open=archive.onclick;archive.onclick=async event=>{menu.open=false;await getMap()?.leaveFullscreen();open(event);};
 let busy=false;async function perform(archiveOnly){
  if(busy)return;busy=true;let controls=[];
  try{menu.open=false;await applyFilters();const map=getMap(),data=getData();if(!map||!data)throw new Error('Load the map before exporting.');const layers=[...getLayers()],heatmap=getHeatmap()&&layers.includes('delivery');controls=[...form.querySelectorAll('input,select,button')].map(node=>[node,node.disabled]);controls.forEach(([node])=>{node.disabled=true;});status.textContent='Preparing map PDF…';const captures=await captureMapPanels({map,data,layers,heatmap,api,token:getToken(),combined:true});const file=await api('/manager/plugins/openstreetmap/export',{method:'POST',token:getToken(),body:{captures,kind:'maps'},timeoutMs:45000});if(!archiveOnly)download(Uint8Array.from(atob(file.content),c=>c.charCodeAt(0)),file.type,file.name,doc);status.textContent=(archiveOnly?'Saved to archive':'Downloaded and archived')+' · '+file.identity.reference;
  }catch(error){status.textContent=error.message||'The map PDF could not be created.';}finally{controls.forEach(([node,disabled])=>{node.disabled=disabled;});busy=false;}
 }
 menu.querySelector('[data-map-download]').onclick=()=>void perform(false);menu.querySelector('[data-map-save]').onclick=()=>void perform(true);
 doc.addEventListener('pointerdown',event=>{if(!menu.contains(event.target)&&!doc.querySelector('.dyws-pdf-dialog[open]'))menu.open=false;});menu.addEventListener('keydown',event=>{if(event.key==='Escape'){menu.open=false;menu.querySelector('summary').focus();event.stopPropagation();}});
 return menu;
}
