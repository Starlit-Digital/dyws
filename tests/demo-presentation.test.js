import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from '../public_html/plugins/demo-lockdown/index.js';

class Node {
 constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.attributes={};this.listeners={};}
 setAttribute(name,value){this.attributes[name]=value;}
 append(...nodes){for(const n of nodes){if(typeof n==='object')n.parent=this;this.children.push(n);}}
 prepend(node){node.parent=this;this.children.unshift(node);}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
 addEventListener(name,fn){this.listeners[name]=fn;}
}
function fixture(page){
 const body=new Node('body'),main=page==='tracking'?null:new Node('main'),footer=page==='storefront'?new Node('footer'):null;
 if(main)body.append(main);if(footer)body.append(footer);
 const doc={body,createElement:tag=>new Node(tag),querySelector:selector=>selector==='main'?main:selector==='footer'?footer:selector==='dyws-ordering'&&page==='storefront'?{}:null};
 const cleanup=[];
 const previous=globalThis.MutationObserver;globalThis.MutationObserver=class{observe(){}disconnect(){}};
 try{register({document:doc,onDestroy:fn=>cleanup.push(fn),addAction(){},provide(){}});}finally{globalThis.MutationObserver=previous;}
 const all=node=>[node,...node.children.filter(n=>typeof n==='object').flatMap(all)];
 return {body,main,footer,all:()=>all(body),destroy:()=>cleanup.forEach(fn=>fn())};
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

import {signInDemo} from '../public_html/plugins/demo-lockdown/demo-login.js';
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
