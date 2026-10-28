/** First paint guard. Server HTML remains available without JavaScript or after a failed startup. */
(()=>{
 const root=document.documentElement;root.dataset.dywsCustomerLoading='true';
 let theme=false,content=false,finished=false;
 const reveal=()=>{if(finished)return;finished=true;clearTimeout(fallback);delete root.dataset.dywsCustomerLoading;document.querySelector('[data-dyws-page-skeleton]')?.remove();document.querySelector('main')?.removeAttribute('aria-busy');if(document.activeElement===document.body)document.querySelector('[autofocus]')?.focus({preventScroll:true});};
 const ready=kind=>{if(kind==='theme')theme=true;if(kind==='content')content=true;if(theme&&content){const styles=scope=>[...scope.querySelectorAll('link[rel=stylesheet]'),...[...scope.querySelectorAll('*')].flatMap(node=>node.shadowRoot?styles(node.shadowRoot):[])];const links=styles(document).filter(link=>!link.sheet);Promise.all(links.map(link=>new Promise(resolve=>{link.addEventListener('load',resolve,{once:true});link.addEventListener('error',resolve,{once:true});}))).then(()=>requestAnimationFrame(reveal));}};
 const fallback=setTimeout(reveal,5000);window.dywsCustomerStartup={ready};
 try{const store=new URL('../',document.currentScript.src),p=JSON.parse(localStorage.getItem('dyws.customer.preferences:'+store.pathname)||'null');const dark=p?.brightness!=null?p.brightness<16:p?.theme==='dark'||(!['light','warm'].includes(p?.theme)&&matchMedia('(prefers-color-scheme:dark)').matches);root.dataset.dywsStartupTheme=dark?'dark':'light';}catch{root.dataset.dywsStartupTheme=matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';}
 document.addEventListener('DOMContentLoaded',()=>{if(!finished)document.querySelector('main')?.setAttribute('aria-busy','true');if(!document.querySelector('[data-dyws-preferences]'))ready('theme');if(document.body.hasAttribute('data-dyws-static-page'))ready('content');if(document.querySelector('[data-dyws-tracking-help]'))ready('content');},{once:true});
 window.addEventListener('pageshow',event=>{if(event.persisted)reveal();});
})();
