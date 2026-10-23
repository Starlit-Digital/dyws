const header=document.querySelector('.site-nav'),toggle=document.querySelector('.menu-toggle'),nav=document.querySelector('#navigation');
function closeMenu(){header.classList.remove('menu-open');toggle.setAttribute('aria-expanded','false')}
toggle.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';header.classList.toggle('menu-open',open);toggle.setAttribute('aria-expanded',String(open))});
nav.addEventListener('click',e=>{const a=e.target.closest('a');if(!a)return;closeMenu();const u=new URL(a.href);if(u.pathname===location.pathname&&u.hash){if(search){search.value='';search.dispatchEvent(new Event('input'))}const section=document.querySelector(u.hash);if(section){section.hidden=false;section.querySelectorAll('.menu-item').forEach(x=>x.hidden=false);section.focus({preventScroll:true})}}});
document.addEventListener('click',e=>{if(!header.contains(e.target))closeMenu()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&header.classList.contains('menu-open')){closeMenu();toggle.focus()}});
const search=document.querySelector('#menu-search');
if(search){function filter(){const q=search.value.toLocaleLowerCase().trim();let total=0;document.querySelectorAll('.menu-category').forEach(section=>{let count=0;section.querySelectorAll('.menu-item').forEach(item=>{item.hidden=!item.textContent.toLocaleLowerCase().includes(q);if(!item.hidden)count++});section.hidden=!count;total+=count});document.querySelector('#menu-count').textContent=total+' dishes shown';document.querySelector('#no-results').hidden=total!==0}search.addEventListener('input',filter);filter()}
const dialog=document.querySelector('#delivery-preview');let deliveryOpener;
document.querySelectorAll('[data-delivery]').forEach(b=>b.addEventListener('click',()=>{deliveryOpener=b;document.querySelector('#delivery-copy').textContent=b.dataset.delivery+' ordering link will go here.';dialog.showModal()}));document.querySelector('#close-delivery').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>deliveryOpener?.focus());
const root=document.documentElement,brightness=document.querySelector('#brightness'),brightnessValue=document.querySelector('#brightness-value'),fontSize=document.querySelector('#font-size'),fontValue=document.querySelector('#font-size-value'),displayPanel=document.querySelector('#display-options'),displayButton=document.querySelector('.display-button');
brightness.value=root.dataset.brightnessStep||'0';fontSize.value=Math.round((parseFloat(root.style.getPropertyValue('--scale'))||1)*21);
function updateDisplay(save=false){const step=Math.max(0,Math.min(31,Number(brightness.value)||0)),size=Math.max(21,Math.min(28,Number(fontSize.value)||21));window.applyCravingsShade(step);root.dataset.largeText=String(size>28);root.style.setProperty('--scale',size/21);brightnessValue.value=(step+1)+' / 32';brightness.setAttribute('aria-valuetext','Shade '+(step+1)+' of 32');fontValue.value=size+' px';fontSize.setAttribute('aria-valuetext',size+' pixels');if(save){try{localStorage.setItem('cravings.display.v2',JSON.stringify({brightness:step,size}))}catch{}}}
brightness.addEventListener('input',()=>updateDisplay(true));fontSize.addEventListener('input',()=>updateDisplay(true));displayPanel.addEventListener('toggle',e=>{displayButton.setAttribute('aria-expanded',String(e.newState==='open'));if(e.newState==='open')closeMenu()});updateDisplay();

new ResizeObserver(()=>root.style.setProperty("--header-height",header.getBoundingClientRect().height+"px")).observe(header);

// Hide on downward scrolling; expose the header for upward scrolling and keyboard use.
let previousScroll=window.scrollY;
function revealHeader(){header.classList.remove('is-scroll-hidden');header.inert=false;}
window.addEventListener('scroll',()=>{const y=Math.max(0,window.scrollY),delta=y-previousScroll;if(Math.abs(delta)<8)return;const readingOpen=displayPanel.matches(':popover-open');if(y<100||delta<0||readingOpen||header.classList.contains('menu-open')||header.contains(document.activeElement)){revealHeader()}else if(y>header.offsetHeight+60){header.classList.add('is-scroll-hidden');header.inert=true}previousScroll=y},{passive:true});
document.addEventListener('keydown',e=>{if(e.key==='Tab')revealHeader()});header.addEventListener('focusin',revealHeader);

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
