export function renderDinerLocation(location){
 const world=256*2**15,toX=l=>(l+180)/360*world,toY=l=>(1-Math.log(Math.tan(l*Math.PI/180)+1/Math.cos(l*Math.PI/180))/Math.PI)/2*world;
 const x=toX(location.longitude)-toX(-113.3980424)+640,y=toY(location.latitude)-toY(53.6166525)+200;
 const block=document.createElement('div');
 if(x<0||x>1280||y<0||y>560){block.textContent='The driver is outside this demo map area. The latest GPS coordinates are shown above.';return block;}
 block.innerHTML=`<svg class="dyws-driver-map" viewBox="0 0 1280 560" role="img" aria-label="Approximate driver position on the Manning area reference map"><image href="images/manning-area-map.png" width="1280" height="560"/><circle cx="${x}" cy="${y}" r="24" fill="#b52e37" stroke="white" stroke-width="8"/><text x="${Math.max(80,Math.min(1150,x))}" y="${Math.max(40,y-40)}" text-anchor="middle" fill="#202124" stroke="#fff8ed" stroke-width="8" paint-order="stroke" font-size="32" font-weight="bold">Driver</text></svg><p class="dyws-note">Approximate position on a reference map. No route or arrival time is calculated.</p>`;
 return block;
}
export function simulateDinerPosition(step){const p=step%20;return {latitude:53.61665-p*.00009,longitude:-113.39804+p*.00008,accuracy:8};}
