import {escapeHTML as esc} from '../../dyws/api.js';
/** Standalone SVG, with zero baseline, negative values and a text alternative. */
export function chartSVG(rows,{title,key,label,format=String,bars=false}={}) {
 const values=rows.map(r=>Number(r[key])||0),low=Math.min(0,...values),maximum=Math.max(bars?2:100,...values),high=bars?Math.ceil(maximum/2)*2:maximum,span=high-low;
 const x=i=>68+(rows.length<2?180:i*370/(rows.length-1)),y=n=>190-(n-low)*150/span;
 const ticks=[low,(low+high)/2,high];
 const grid=ticks.map(n=>`<path d="M68 ${y(n)}H438" stroke="currentColor" opacity=".18"/><text x="60" y="${y(n)+4}" text-anchor="end">${esc(format(n))}</text>`).join('');
 const marks=bars?values.map((n,i)=>`<rect x="${x(i)-Math.min(14,140/rows.length)}" y="${Math.min(y(n),y(0))}" width="${Math.min(28,280/rows.length)}" height="${Math.abs(y(n)-y(0))}" fill="#9b5b11"><title>${esc(rows[i][label])}: ${esc(format(n))}</title></rect>`).join(''):`<polyline points="${values.map((v,i)=>`${x(i)},${y(v)}`).join(' ')}" fill="none" stroke="#9b5b11" stroke-width="3"/>`+values.map((v,i)=>`<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="#9b5b11"><title>${esc(rows[i][label])}: ${esc(format(v))}</title></circle>`).join('');
 const labels=[...new Set([0,Math.floor((rows.length-1)/2),rows.length-1])].filter(i=>i>=0&&rows[i]).map(i=>`<text x="${x(i)}" y="218" text-anchor="${i===0?'start':i===rows.length-1?'end':'middle'}">${esc(rows[i][label])}</text>`).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 240" role="img" aria-label="${esc(title)}" style="font:14px system-ui;color:#524b44;background:#fff8ed;border-radius:12px"><title>${esc(title)}</title><desc>${esc(rows.length?`${rows.length} days. Minimum ${format(Math.min(...values))}; maximum ${format(Math.max(...values))}. Exact values are available in the daily data table.`:'No data for this range.')}</desc><g fill="currentColor">${grid}${marks}${labels}</g></svg>`;
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
