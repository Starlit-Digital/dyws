/** Order weighted Gaussian density, computed locally from approximate delivery areas. */
export const HEAT_SIGMA_METRES=550;
export function heatColor(ratio){
 const t=Math.max(0,Math.min(1,Number(ratio)||0)),L=.42+.42*t,C=.10,h=155*Math.PI/180,a=C*Math.cos(h),b=C*Math.sin(h);
 const l=(L+.3963377774*a+.2158037573*b)**3,m=(L-.1055613458*a-.0638541728*b)**3,s=(L-.0894841775*a-1.291485548*b)**3;
 return [4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.707614701*s].map(v=>Math.round(255*(v<=.0031308?12.92*Math.max(0,v):1.055*Math.max(0,v)**(1/2.4)-.055))).map(v=>Math.max(0,Math.min(255,v)));
}
/** Fixed source based normalization, so panning does not change the scale. */
export function densityPeak(points,sigma=HEAT_SIGMA_METRES){
 if(!points.length)return 1;const cos=Math.cos(points[0].latitude*Math.PI/180),cells=new Map(),projected=points.map(p=>({x:p.longitude*111195*cos,y:p.latitude*111195,weight:Math.max(0,p.orders)}));
 for(const p of projected){const key=`${Math.floor(p.x/sigma)},${Math.floor(p.y/sigma)}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(p);}
 let peak=1;for(const p of projected){let value=0;const cx=Math.floor(p.x/sigma),cy=Math.floor(p.y/sigma);for(let dx=-3;dx<=3;dx++)for(let dy=-3;dy<=3;dy++)for(const q of cells.get(`${cx+dx},${cy+dy}`)||[]){const d2=(p.x-q.x)**2+(p.y-q.y)**2;if(d2<=9*sigma*sigma)value+=q.weight*Math.exp(-d2/(2*sigma*sigma));}peak=Math.max(peak,value);}return peak;
}
export function densityRaster(width,height,points,sigma){
 const values=new Float32Array(width*height);if(!(sigma>0))return values;const radius=Math.ceil(3*sigma),denominator=2*sigma*sigma;
 for(const p of points){if(!(p.weight>0))continue;const left=Math.max(0,Math.floor(p.x-radius)),right=Math.min(width-1,Math.ceil(p.x+radius)),top=Math.max(0,Math.floor(p.y-radius)),bottom=Math.min(height-1,Math.ceil(p.y+radius));for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){const d2=(x-p.x)**2+(y-p.y)**2;if(d2<=9*sigma*sigma)values[y*width+x]+=p.weight*Math.exp(-d2/denominator);}}
 return values;
}
export function createHeatmap(L,map,doc){
 let points=[],enabled=false,peak=1,frame=0,disposed=false;const node=doc.createElement('canvas');node.className='dyws-osm-heat-canvas';node.setAttribute('aria-hidden','true');node.style.pointerEvents='none';const pane=map.createPane('order-density');pane.style.zIndex='350';pane.style.pointerEvents='none';pane.append(node);
 const legend=L.control({position:'bottomright'}),label=doc.createElement('div');label.className='dyws-osm-heat-legend';label.innerHTML='<strong>Delivery density</strong><div><span>Lower</span><i></i><span>Higher</span></div>';legend.onAdd=()=>label;legend.addTo(map);
 const draw=()=>{frame=0;if(disposed)return;node.hidden=label.hidden=!enabled||!points.length;if(node.hidden)return;const size=map.getSize(),step=Math.max(3,Math.ceil(Math.max(size.x,size.y)/600));node.width=Math.ceil(size.x/step);node.height=Math.ceil(size.y/step);node.style.width=size.x+'px';node.style.height=size.y+'px';L.DomUtil.setPosition(node,map.containerPointToLayerPoint([0,0]));const center=map.getCenter(),a=map.latLngToContainerPoint(center),b=map.latLngToContainerPoint([center.lat+HEAT_SIGMA_METRES/111195,center.lng]),sigma=Math.max(.7,Math.abs(b.y-a.y)/step),projected=points.map(p=>{const xy=map.latLngToContainerPoint([p.latitude,p.longitude]);return {x:xy.x/step,y:xy.y/step,weight:p.orders};});const values=densityRaster(node.width,node.height,projected,sigma),context=node.getContext('2d'),image=context.createImageData(node.width,node.height);
  for(let i=0;i<values.length;i++){const t=Math.min(1,values[i]/peak);if(t<.003)continue;const rgb=heatColor(t);image.data.set(rgb,i*4);image.data[i*4+3]=Math.round(230*Math.min(1,t*4));}context.putImageData(image,0,0);
 };
 const schedule=()=>{if(!frame)frame=doc.defaultView.requestAnimationFrame(draw);};map.on('moveend zoomend resize',schedule);
 return {show(next,active){points=next.filter(p=>p.layer==='delivery'&&p.orders>0);enabled=active;peak=densityPeak(points);schedule();},destroy(){disposed=true;doc.defaultView.cancelAnimationFrame(frame);map.off('moveend zoomend resize',schedule);legend.remove();pane.remove();}};
}
