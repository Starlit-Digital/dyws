import {getDocument,GlobalWorkerOptions} from './vendor/pdfjs/pdf.min.mjs';
GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.min.mjs',import.meta.url).href;

/** One rendered page at a time, bounded memory, local fonts and worker only. */
export function createPDFViewer(host,bytes,title,controls=host){
 const doc=host.ownerDocument;
 controls.innerHTML='<div class="dyws-pdf-page-tools"><button type="button" class="dyws-secondary" data-page-prev aria-label="Previous PDF page" disabled>Prev</button><label>Page <input data-page type="number" min="1" value="1" aria-label="PDF page" disabled></label><span data-page-count></span><button type="button" class="dyws-secondary" data-page-next aria-label="Next PDF page" disabled>Next</button><select data-zoom aria-label="Zoom"><option value="fit">Fit width</option><option value="page">Fit page</option><option value="1">100%</option><option value="1.25">125%</option><option value="1.5">150%</option><option value="2">200%</option></select><details class="dyws-pdf-page-text"><summary>Text</summary><p></p></details><span role="status" data-render-status>Loading PDF…</span></div>';
 host.innerHTML='<div class="dyws-pdf-canvas-scroll"><canvas role="img"></canvas></div>';
 const canvas=host.querySelector('canvas'),scroll=host.querySelector('.dyws-pdf-canvas-scroll'),status=controls.querySelector('[data-render-status]'),input=controls.querySelector('[data-page]'),previous=controls.querySelector('[data-page-prev]'),next=controls.querySelector('[data-page-next]'),zoom=controls.querySelector('[data-zoom]'),text=controls.querySelector('.dyws-pdf-page-text p');
 let pdf=null,pageNumber=1,render=null,version=0,disposed=false,timer=null;
 const loading=getDocument({data:bytes.slice(),standardFontDataUrl:new URL('./vendor/pdfjs/standard_fonts/',import.meta.url).href,isEvalSupported:false,useWasm:false});
 async function draw(){
  if(!pdf||disposed)return;const current=++version;render?.cancel();status.textContent='Rendering…';
  try{
   const page=await pdf.getPage(pageNumber);if(disposed||current!==version)return;
   const base=page.getViewport({scale:1}),scale=['fit','page'].includes(zoom.value)?Math.max(.1,Math.min((scroll.clientWidth-8)/base.width,zoom.value==='page'?(scroll.clientHeight-8)/base.height:Infinity)):Number(zoom.value),viewport=page.getViewport({scale}),ratio=Math.min(window.devicePixelRatio||1,2);
   canvas.width=Math.ceil(viewport.width*ratio);canvas.height=Math.ceil(viewport.height*ratio);canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';canvas.setAttribute('aria-label',`${title}, page ${pageNumber} of ${pdf.numPages}`);
   input.value=pageNumber;previous.disabled=pageNumber===1;next.disabled=pageNumber===pdf.numPages;text.textContent='';
   render=page.render({canvasContext:canvas.getContext('2d'),viewport,transform:ratio===1?null:[ratio,0,0,ratio,0,0]});await render.promise;if(disposed||current!==version)return;
   const content=await page.getTextContent();if(disposed||current!==version)return;text.textContent=content.items.map(item=>item.str+(item.hasEOL?'\n':' ')).join('');status.textContent='';
  }catch(error){if(!disposed&&current===version&&error.name!=='RenderingCancelledException')status.textContent='Could not render this page. Download the PDF or open it in a tab.';}
 }
 const go=value=>{if(!pdf)return;pageNumber=Math.max(1,Math.min(pdf.numPages,Number(value)||1));scroll.scrollTop=0;void draw();};
 previous.onclick=()=>go(pageNumber-1);next.onclick=()=>go(pageNumber+1);input.onchange=()=>go(input.value);zoom.onchange=()=>void draw();
 const observer=new ResizeObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>{if(['fit','page'].includes(zoom.value))void draw();},120);});observer.observe(scroll);
 const ready=loading.promise.then(async value=>{if(disposed){await value.destroy();return;}pdf=value;input.disabled=false;input.max=pdf.numPages;controls.querySelector('[data-page-count]').textContent=`of ${pdf.numPages}`;await draw();}).catch(()=>{if(!disposed)status.textContent='Could not open this PDF. Download it or open it in a tab.';});
 return {ready,destroy(){disposed=true;version++;clearTimeout(timer);observer.disconnect();render?.cancel();void loading.destroy();}};
}
