import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from '../public_html/plugins/demo-lockdown/index.js';

class Node {
 constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.attributes={};this.listeners={};}
 setAttribute(name,value){this.attributes[name]=value;}
 removeAttribute(name){delete this.attributes[name];}
 append(...nodes){for(const n of nodes){if(typeof n==='object')n.parent=this;this.children.push(n);}}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 prepend(node){node.parent=this;this.children.unshift(node);}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
 addEventListener(name,fn){this.listeners[name]=fn;}
}
function fixture(page,orderId=null){
 const body=new Node('body'),main=page==='tracking'?null:new Node('main'),footer=page==='storefront'?new Node('footer'):null;
 if(main)body.append(main);if(footer)body.append(footer);
 const doc={body,createElement:tag=>new Node(tag),querySelector:selector=>selector==='main'?main:selector==='footer'?footer:selector==='dyws-ordering'&&page==='storefront'?{}:null};
 if(orderId)doc.defaultView={location:{href:'https://example.test/driver/#order='+orderId},addEventListener(){},removeEventListener(){}};
 const cleanup=[],actions={},driverActions=page==='driver'?new Node('div'):null;
 if(driverActions)main.append(driverActions);
 const query=doc.querySelector;doc.querySelector=selector=>selector==='#driver-board:not([hidden]) > .dyws-actions'?driverActions:query(selector);
 const previous=globalThis.MutationObserver;globalThis.MutationObserver=class{observe(){}disconnect(){}};
 try{register({document:doc,onDestroy:fn=>cleanup.push(fn),addAction:(name,fn)=>{actions[name]=fn;},provide(){}});}finally{globalThis.MutationObserver=previous;}
 const all=node=>[node,...node.children.filter(n=>typeof n==='object').flatMap(all)];
 return {body,main,footer,actions,driverActions,all:()=>all(body),destroy:()=>cleanup.forEach(fn=>fn())};
}
test('The public storefront has one demo callout at each end and cleans both up',()=>{
 const page=fixture('storefront');assert.equal(page.main.children[0].dataset.dywsDemo,'top');assert.equal(page.footer.children.at(-1).dataset.dywsDemo,'bottom');
 assert.equal(page.all().filter(n=>n.dataset.dywsDemo).length,2);page.destroy();assert.equal(page.all().filter(n=>n.dataset.dywsDemo).length,0);
});
test('Tracking and operator pages do not repeat the storefront credential boxes',()=>{
 for(const name of ['tracking','orders','driver']){
  const page=fixture(name);assert.equal(page.all().filter(n=>n.dataset.dywsDemo).length,0,name+' must keep its workflow clear');page.destroy();
 }
});

import {signInDemo,createDemoAccess} from '../public_html/plugins/demo-lockdown/demo-login.js';
function loginFixture(){
 const body=new Node('body'),submitted=[],visited=[];
 const doc={body,createElement(tag){const node=new Node(tag);if(tag==='form')node.submit=()=>submitted.push({method:node.method,url:node.action,fields:Object.fromEntries(node.children.map(n=>[n.name,n.value]))});return node;}};
 return {doc,submitted,visited,navigate:url=>visited.push(url),baseURL:'https://example.test/diner/'};
}
test('Demo buttons submit public credentials through the normal CSRF protected forms',async()=>{
 for(const [role,path,field] of [['admin','auth/','username'],['driver','driver/','driverId']]){
  const f=loginFixture(),csrf='a'.repeat(64),requests=[];
  await signInDemo(role,{document:f.doc,navigate:f.navigate,baseURL:f.baseURL,
   request:async(url,options)=>{requests.push({url,options});return {ok:true,url,text:async()=>'<existing sign in form>'};},
   parse:html=>{assert.equal(html,'<existing sign in form>');return {querySelector:selector=>selector==='form input[name="csrf"]'?{value:csrf}:null};}});
  assert.deepEqual(requests,[{url:f.baseURL+path,options:{credentials:'same-origin',mode:'same-origin',cache:'no-store'}}]);
  assert.deepEqual(f.submitted,[{method:'post',url:f.baseURL+path,fields:{csrf,[field]:role,password:role}}]);assert.deepEqual(f.visited,[]);
 }
});
test('Existing demo sessions open their console without submitting another sign in',async()=>{
 for(const role of ['admin','driver']){
  const f=loginFixture(),url=f.baseURL+(role==='admin'?'orders/':'driver/');
  await signInDemo(role,{document:f.doc,navigate:f.navigate,baseURL:f.baseURL,request:async()=>({ok:true,url,text:async()=>''}),parse:()=>({querySelector:selector=>selector==='#driver-board:not([hidden])'?{}:null})});
  assert.deepEqual(f.visited,[url]);assert.deepEqual(f.submitted,[]);
 }
});
test('Failed, unexpected or missing CSRF forms never submit demo credentials',async()=>{
 for(const response of [{ok:false,url:'https://example.test/diner/auth/'},{ok:true,url:'https://other.test/auth/'},{ok:true,url:'https://example.test/diner/auth/'}]){
  const f=loginFixture();await assert.rejects(signInDemo('admin',{document:f.doc,navigate:f.navigate,baseURL:f.baseURL,request:async()=>({...response,text:async()=>''}),parse:()=>({querySelector:()=>null})}));
  assert.deepEqual(f.submitted,[]);assert.deepEqual(f.visited,[]);
 }
});

test('Demo navigation lives inside the selected order and the signed in driver toolbar',()=>{
 const admin=fixture('orders'),orderPanel=new Node('div');
 const id='DYWS-000000000002';admin.actions['admin:order']({root:orderPanel,order:{id}});
 const [driverAccess,tracking]=orderPanel.children[0].children;
 assert.equal(driverAccess.children[0].textContent,'Open Driver demo');
 assert.equal(new URL(driverAccess.children[0].href).searchParams.get('demo'),'driver');
 assert.equal(new URL(driverAccess.children[0].href).hash,'#order='+id);
 assert.equal(tracking.textContent,'View customer tracking');assert.equal(new URL(tracking.href).searchParams.get('order'),id);
 assert.ok(new URL(tracking.href).pathname.endsWith('/plugins/demo-lockdown/tracking.php'));assert.equal(new URL(tracking.href).hash,'');
 const driver=fixture('driver',id),link=driver.driverActions.children[0].children[0];
 assert.equal(link.textContent,'Admin orders');assert.equal(new URL(link.href).searchParams.get('demo'),'admin');
 assert.equal(new URL(link.href).hash,'#order='+id);
 driver.destroy();assert.equal(driver.driverActions.children.length,0);admin.destroy();
});
test('Customer tracking offers compact links back to the same Admin and Driver order',()=>{
 const page=fixture('tracking'),root=new Node('div'),id='DYWS-000000000003';
 page.actions['tracking:updated']({root,order:{id}});
 const links=root.children[0].children.map(access=>access.children[0]);
 assert.deepEqual(links.map(link=>link.textContent),['Admin orders','Open Driver demo']);
 assert.deepEqual(links.map(link=>new URL(link.href).hash),['#order='+id,'#order='+id]);
 assert.equal(page.all().filter(n=>n.dataset.dywsDemo).length,0);page.destroy();
});

test('Order selection survives both fresh form sign in and existing sessions for each role',async()=>{
 const id='DYWS-000000000002';
 for(const role of ['admin','driver'])for(const signedIn of [false,true]){
  const f=loginFixture(),path=role==='admin'?'auth/':'driver/',destination=role==='admin'?'orders/':'driver/';
  await signInDemo(role,{document:f.doc,navigate:f.navigate,baseURL:f.baseURL,orderId:id,
   request:async()=>({ok:true,url:f.baseURL+(signedIn?destination:path),text:async()=>''}),
   parse:()=>({querySelector:selector=>signedIn?selector==='#driver-board:not([hidden])'?{}:null:selector==='form input[name="csrf"]'?{value:'a'.repeat(64)}:null})});
  if(signedIn)assert.deepEqual(f.visited,[f.baseURL+destination+'#order='+id]);
  else assert.equal(f.submitted[0].url,f.baseURL+path+'#order='+id);
 }
});
test('Shared entry and retry preserve the order without copying arbitrary destinations',async()=>{
 const f=loginFixture(),id='DYWS-000000000002',calls=[];
 f.doc.defaultView={location:{href:f.baseURL+'?demo=driver&next=https://other.test#order='+id},history:{replaceState(){}}};
 const access=createDemoAccess({document:f.doc,baseURL:f.baseURL,signIn:async(role,options)=>{calls.push({role,id:options.orderId});throw new Error('retry');}}),box=access.link('driver','Driver');
 await access.enterFromURL();await box.children[0].listeners.click({button:0,preventDefault(){}});
 assert.deepEqual(calls,[{role:'driver',id},{role:'driver',id}]);assert.equal(box.children[0].href,f.baseURL+'?demo=driver#order='+id);
});
test('Shareable demo entries sign in once, consume only their query and retain normal link behavior',async()=>{
 for(const role of ['admin','driver']){
  const f=loginFixture(),calls=[],history=[];
  f.doc.defaultView={location:{href:f.baseURL+'?demo='+role+'&keep=yes#menu'},history:{state:{example:true},replaceState:(...args)=>history.push(args)}};
  const access=createDemoAccess({document:f.doc,baseURL:f.baseURL,signIn:async value=>calls.push(value)}),box=access.link(role,'Open demo'),anchor=box.children[0];
  assert.equal(anchor.href,f.baseURL+'?demo='+role);
  let prevented=false;
  anchor.listeners.click({button:0,ctrlKey:true,preventDefault:()=>{prevented=true;}});
  assert.equal(prevented,false);assert.deepEqual(calls,[]);
  await access.enterFromURL();assert.deepEqual(calls,[role]);
  assert.deepEqual(history,[[{example:true},'',f.baseURL+'?keep=yes#menu']]);
  await anchor.listeners.click({button:0,preventDefault(){}});assert.deepEqual(calls,[role]);
 }
});
test('Failed shortcuts show the manual form and permit a retry without an automatic login loop',async()=>{
 const f=loginFixture();let attempts=0;
 const access=createDemoAccess({document:f.doc,baseURL:f.baseURL,signIn:async()=>{attempts++;throw new Error('Unavailable');}});
 const box=access.link('admin','Admin orders'),[anchor,feedback]=box.children;
 await anchor.listeners.click({button:0,preventDefault(){}});
 assert.equal(feedback.hidden,false);assert.equal(anchor.attributes['aria-disabled'],undefined);
 assert.equal(feedback.children[1].href,f.baseURL+'auth/');
 await anchor.listeners.click({button:0,preventDefault(){}});assert.equal(attempts,2);
});
test('Unrecognized demo roles never start a login or change browser history',async()=>{
 for(const role of ['owner','constructor','__proto__','https://other.test']){
  const f=loginFixture();f.doc.defaultView={location:{href:f.baseURL+'?demo='+encodeURIComponent(role)},history:{replaceState:()=>assert.fail('No history change')}};
  const access=createDemoAccess({document:f.doc,baseURL:f.baseURL,signIn:()=>assert.fail('No login')});access.link('admin','Admin');access.link('driver','Driver');
  await access.enterFromURL();assert.throws(()=>access.link(role,'Invalid'));
  await assert.rejects(signInDemo(role,{request:()=>assert.fail('No request')}));
 }
});
