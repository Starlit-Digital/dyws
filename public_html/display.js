const root=document.documentElement,brightness=document.querySelector('#brightness'),fontSize=document.querySelector('#font-size');
brightness.value=root.dataset.brightnessStep||'0';fontSize.value=parseInt(root.style.getPropertyValue('--font-size'))||17;
function updateDisplay(save=false){const step=Number(brightness.value),size=Math.max(17,Math.min(24,Number(fontSize.value)||17));window.applyDywsShade(step);root.style.setProperty('--font-size',size+'px');document.querySelector('#brightness-value').textContent=(step+1)+' / 32';document.querySelector('#font-size-value').textContent=size+' px';if(save)try{localStorage.setItem('dyws.diner.display.v1',JSON.stringify({brightness:step,size}));}catch{}}
brightness.addEventListener('input',()=>updateDisplay(true));fontSize.addEventListener('input',()=>updateDisplay(true));updateDisplay();
const panel=document.querySelector('#display-options'),button=document.querySelector('.display-button');panel.addEventListener('toggle',event=>button.setAttribute('aria-expanded',String(event.newState==='open')));
// Retain native range semantics and keyboard support; extend pointer input to the whole lane.
for(const slider of [brightness,fontSize]){
 let activePointer=null;
 const paint=()=>slider.style.setProperty('--range-fill',((Number(slider.value)-Number(slider.min))/(Number(slider.max)-Number(slider.min))*100)+'%');
 const setFromPointer=event=>{const rect=slider.getBoundingClientRect(),inset=Math.min(22,rect.width/2),track=Math.max(1,rect.width-2*inset);let fraction=Math.max(0,Math.min(1,(event.clientX-rect.left-inset)/track));if(getComputedStyle(slider).direction==='rtl')fraction=1-fraction;const min=Number(slider.min),max=Number(slider.max),step=Number(slider.step)||1;slider.value=String(Math.max(min,Math.min(max,min+Math.round((max-min)*fraction/step)*step)));slider.dispatchEvent(new Event('input',{bubbles:true}));};
 slider.addEventListener('input',paint);paint();
 slider.addEventListener('pointerdown',event=>{if(!event.isPrimary||event.button!==0)return;event.preventDefault();activePointer=event.pointerId;slider.focus({preventScroll:true});slider.setPointerCapture(event.pointerId);setFromPointer(event)});
 slider.addEventListener('pointermove',event=>{if(event.pointerId===activePointer){event.preventDefault();setFromPointer(event)}});
 const finish=event=>{if(event.pointerId!==activePointer)return;activePointer=null;if(slider.hasPointerCapture(event.pointerId))slider.releasePointerCapture(event.pointerId);slider.dispatchEvent(new Event('change',{bubbles:true}))};
 slider.addEventListener('pointerup',finish);slider.addEventListener('pointercancel',finish);slider.addEventListener('lostpointercapture',()=>activePointer=null);
}
