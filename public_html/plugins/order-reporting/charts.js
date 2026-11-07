import {escapeHTML as esc} from '../../dyws/api.js';
/** Standalone SVG, with zero baseline, negative values and a text alternative. */
export function chartSVG(rows,{title,key,label,format=String,bars=false}={}) {
 const values=rows.map(r=>Number(r[key])||0),low=Math.min(0,...values),maximum=Math.max(bars?2:100,...values),high=bars?Math.ceil(maximum/2)*2:maximum,span=high-low;
 const x=i=>110+(rows.length<2?180:i*368/(rows.length-1)),y=n=>190-(n-low)*150/span;
 const ticks=[low,(low+high)/2,high];
 const grid=ticks.map(n=>`<path d="M110 ${y(n)}H478" stroke="currentColor" opacity=".18"/><text x="102" y="${y(n)+4}" text-anchor="end">${esc(format(n))}</text>`).join('');
 const marks=bars?values.map((n,i)=>`<rect class="dyws-chart-bar" data-chart-mark="${i}" x="${x(i)-Math.min(14,140/rows.length)}" y="${Math.min(y(n),y(0))}" width="${Math.min(28,280/rows.length)}" height="${Math.abs(y(n)-y(0))}" fill="#9b5b11"><title>${esc(rows[i][label])}: ${esc(format(n))}</title></rect>`).join(''):`<polyline points="${values.map((v,i)=>`${x(i)},${y(v)}`).join(' ')}" fill="none" stroke="#9b5b11" stroke-width="3"/>`+values.map((v,i)=>`<circle class="dyws-chart-dot" data-chart-mark="${i}" cx="${x(i)}" cy="${y(v)}" r="3" fill="#9b5b11"><title>${esc(rows[i][label])}: ${esc(format(v))}</title></circle>`).join('');
 const targets=rows.map((row,i)=>{const start=i===0?110:(x(i-1)+x(i))/2,end=i===rows.length-1?478:(x(i)+x(i+1))/2,text=esc(`${row[label]} · ${format(values[i])}`);return `<rect class="dyws-chart-hit" data-chart-tip="${text}" data-chart-index="${i}" tabindex="0" role="img" aria-label="${text}" x="${start}" y="40" width="${Math.max(1,end-start)}" height="150" fill="transparent"><title>${text}</title></rect>`;}).join('');
 const labels=[...new Set([0,Math.floor((rows.length-1)/2),rows.length-1])].filter(i=>i>=0&&rows[i]).map(i=>`<text x="${x(i)}" y="218" text-anchor="${i===0?'start':i===rows.length-1?'end':'middle'}">${esc(rows[i][label])}</text>`).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 240" role="group" aria-label="${esc(title)}" style="font:14px system-ui;color:#524b44;background:#fff8ed;border-radius:12px"><title>${esc(title)}</title><desc>${esc(rows.length?`${rows.length} days. Minimum ${format(Math.min(...values))}; maximum ${format(Math.max(...values))}. Exact values are available in the daily data table.`:'No data for this range.')}</desc><g fill="currentColor">${grid}<g aria-hidden="true">${marks}</g>${labels}${targets}</g></svg>`;
}
export function csvText(rows) {
 return rows.map(row=>row.map(value=>{
  let text=String(value??'');if(typeof value==='string'&&/^[\s]*[=+@\-\t\r]/.test(text))text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
 }).join(',')).join('\r\n')+'\r\n';
}
export function comparison(current,previous,format=String) {
 if(!previous)return current?'No previous baseline':'No change';
 const difference=current-previous;
 return `${difference>0?'↑':difference<0?'↓':'='} ${Math.abs(difference/previous*100).toFixed(1)}% · previously ${format(previous)}`;
}
export function download(text,type,name,doc=document) {
 const url=URL.createObjectURL(new Blob([text],{type})),a=doc.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

/** Ranked pie with exact values and a matching numbered text legend. */
export function topItemsPie(items) {
 const rows=items.filter(item=>Number(item.quantity)>0).slice().sort((a,b)=>b.quantity-a.quantity).slice(0,10);
 const total=rows.reduce((sum,item)=>sum+Number(item.quantity),0);
 if(!total)return '<p class="dyws-note">No orders.</p>';
 const colors=['#8cd7a3','#dfbc66','#68c4b3','#ec967c','#90b5db','#bad17c','#e6a3b3','#c7b89a','#6dba87','#e3ca96'];
 const point=a=>[160+140*Math.cos(a),160+140*Math.sin(a)].map(n=>n.toFixed(3));let angle=-Math.PI/2;
 const segments=rows.map((item,i)=>{
  const sweep=Number(item.quantity)/total*Math.PI*2,start=point(angle),end=point(angle+sweep),middle=angle+sweep/2;
  const name=item.name+(item.option?' · '+item.option:''),percent=(item.quantity/total*100).toFixed(1);
  const title=esc(`${i+1}. ${name}: ${item.quantity} units, ${percent}% of top 10`);
  const shape=rows.length===1?`<circle cx="160" cy="160" r="140" fill="${colors[i]}"><title>${title}</title></circle>`:`<path d="M160 160 L${start.join(' ')} A140 140 0 ${sweep>Math.PI?1:0} 1 ${end.join(' ')} Z" fill="${colors[i]}"><title>${title}</title></path>`;
  angle+=sweep;
  return shape+`<text x="${(160+98*Math.cos(middle)).toFixed(3)}" y="${(160+98*Math.sin(middle)).toFixed(3)}" text-anchor="middle" dominant-baseline="central" fill="#101512">${i+1}</text>`;
 }).join('');
 const legend=rows.map((item,i)=>`<li><span class="dyws-pie-rank" data-pie-color="${i}">${i+1}</span><span>${esc(item.name+(item.option?' · '+item.option:''))}</span><span class="dyws-pie-value"><strong>${item.quantity}</strong><small>${(item.quantity/total*100).toFixed(1)}%</small></span></li>`).join('');
 return `<div class="dyws-top-items-pie"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" role="img" aria-label="Top 10 items by quantity"><title>Top 10 items by quantity</title><desc>Share of ${total} units across these ${rows.length} items. Exact counts and percentages are in the numbered legend.</desc><g stroke="var(--dyws-color-surface,#19211c)" stroke-width="2">${segments}</g></svg><ol aria-label="Top 10 item quantities">${legend}</ol></div>`;
}

let tooltipSequence=0;
export function mountChartTooltips(root) {
 for(const section of root.querySelectorAll('.dyws-report-chart')){
  const svg=section.querySelector('svg'),tip=section.ownerDocument.createElement('div');
  tip.className='dyws-chart-tooltip';tip.id='dyws-chart-tooltip-'+(++tooltipSequence);tip.setAttribute('role','tooltip');tip.hidden=true;section.append(tip);
  for(const point of svg.querySelectorAll('[data-chart-tip]'))point.setAttribute('aria-describedby',tip.id);
  let selected=null;
  const clear=()=>{tip.hidden=true;if(selected){selected.removeAttribute('data-active');if(selected.tagName.toLowerCase()==='circle')selected.setAttribute('r','3');selected=null;}};
  const show=(point,event)=>{if(!point){clear();return;}const markNode=svg.querySelector('[data-chart-mark="'+point.dataset.chartIndex+'"]');if(selected!==markNode){clear();selected=markNode;selected?.setAttribute('data-active','');if(selected?.tagName.toLowerCase()==='circle')selected.setAttribute('r','7');}tip.textContent=point.dataset.chartTip;tip.hidden=false;const bounds=section.getBoundingClientRect(),mark=point.getBoundingClientRect();const x=event?.clientX??(mark.left+mark.width/2),y=event?.clientY??mark.top;tip.style.left=Math.max(8,Math.min(bounds.width-tip.offsetWidth-8,x-bounds.left-tip.offsetWidth/2))+'px';tip.style.top=Math.max(8,y-bounds.top-tip.offsetHeight-12)+'px';};
  svg.addEventListener('pointermove',event=>show(event.target.closest('[data-chart-tip]'),event));
  svg.addEventListener('pointerleave',clear);
  svg.addEventListener('focusin',event=>show(event.target.closest('[data-chart-tip]')));
  svg.addEventListener('focusout',clear);
  svg.addEventListener('keydown',event=>{if(event.key==='Escape')clear();});
 }
}

export function pdfButton(target,title) {return `<button type="button" class="dyws-secondary" data-pdf="${esc(target)}" aria-label="Download ${esc(title)} as PDF">PDF</button>`;}
