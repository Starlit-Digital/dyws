import {validate} from './accessibility/shared/preferences.js';
/** The same accessibility controls and per-store preferences on every customer page. */
const widget=document.querySelector('[data-dyws-preferences]');
if(widget){
 const target=document.body,store=new URL('../',import.meta.url),key='dyws.customer.preferences:'+store.pathname;
 widget.setAttribute('storage-key',key);widget.setAttribute('target','body');target.setAttribute('data-a11y-content','');
 try{
  if(!localStorage.getItem(key)){
   const slug=store.pathname.split('/').filter(Boolean).at(-1)||'diner';
   const shared=localStorage.getItem('dyws.'+slug+'.preferences.v1');
   if(shared)localStorage.setItem(key,JSON.stringify(validate(JSON.parse(shared))));
   else if(window.dywsPalette&&(slug==='diner'||store.pathname==='/')){const legacy=JSON.parse(localStorage.getItem('dyws.diner.display.v1')||'null');if(legacy)localStorage.setItem(key,JSON.stringify({brightness:legacy.brightness??(legacy.mode==='light'?31:0),size:(legacy.size||17)/17}));}
  }
 }catch{/* Preferences work for this page when device storage is unavailable. */}
 const style=document.createElement('link');const contentReady=new Promise(resolve=>{style.onload=resolve;style.onerror=resolve;});style.rel='stylesheet';style.href=new URL('./accessibility/shared/content.css',import.meta.url).href;document.head.append(style);
 target.addEventListener('starlit:a11y-change',event=>{
  const {preferences:p}=event.detail;target.dataset.readingFont=p.font;target.dataset.dywsCustomerPage='';let colors=event.detail.palette;
  if(window.dywsPalette){
   const step=p.brightness??(p.theme==='light'||p.theme==='warm'?31:p.theme==='dark'?0:matchMedia('(prefers-color-scheme:dark)').matches?0:31);
   window.applyDywsShade(step);const c=window.dywsPalette(step);colors={page:c.page,panel:c.panel,raised:c.raised,text:c.ink,muted:c.muted,accent:c.red,line:c.line};
   for(const [name,value]of Object.entries(colors))target.style.setProperty('--sda-'+name,value);
  }
  if(p.font==='studio')target.style.setProperty('--sda-font','ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif');
  document.documentElement.style.fontSize='17px';document.documentElement.style.setProperty('--font-size',(17*p.size)+'px');document.documentElement.style.colorScheme=event.detail.palette.dark?'dark':'light';document.documentElement.style.background=colors.page;
  target.style.setProperty('--page',colors.page);target.style.setProperty('--panel',colors.panel);target.style.setProperty('--ink',colors.text);target.style.setProperty('--muted',colors.muted);target.style.setProperty('--accent',colors.accent);target.style.setProperty('--line',colors.line);target.style.setProperty('--on-accent',colors.page);
  for(const [name,value]of Object.entries({bg:colors.page,surface:colors.panel,raised:colors.raised||colors.panel,text:colors.text,muted:colors.muted,accent:colors.accent,emphasis:colors.accent,warm:colors.accent,'button-text':colors.page,border:colors.line}))target.style.setProperty('--dyws-'+name,value);
  target.style.setProperty('--dyws-font',`${17*p.size}px/${p.leading} ${getComputedStyle(target).getPropertyValue('--sda-font')}`);
 });
 await import('./accessibility/components/preferences-center/index.js');
 await contentReady;
 await Promise.all([...widget.shadowRoot.querySelectorAll('link[rel=stylesheet]')].map(link=>link.sheet?Promise.resolve():new Promise(resolve=>{link.addEventListener('load',resolve,{once:true});link.addEventListener('error',resolve,{once:true});})));
 target.dataset.dywsPreferencesReady='true';
}
