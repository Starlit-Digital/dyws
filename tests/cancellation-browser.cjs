const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const {spawn,execFileSync}=require('node:child_process');
(async()=>{
 const root=path.resolve(__dirname,'..'),fixture=fs.mkdtempSync(path.join(os.tmpdir(),'dyws-cancel-browser-'));
 execFileSync('php',[path.join(root,'server/setup.php'),fixture]);
 const access=fs.readFileSync(path.join(fixture,'LOCAL-ACCESS.txt'),'utf8');
 const managerPassword=access.match(/Manager password: (.+)/)[1],driverPassword=access.match(/Driver password: (.+)/)[1];
 const socket=net.createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
 const server=spawn('php',['-S',`127.0.0.1:${port}`,'-t',path.join(root,'public_html'),path.join(root,'server/router.php')],{env:{...process.env,DYWS_CONFIG:path.join(fixture,'config.json')},stdio:'ignore'});
 const base=`http://127.0.0.1:${port}`,screenshots=process.env.DYWS_CANCEL_SCREENSHOTS||fixture;fs.mkdirSync(screenshots,{recursive:true});
 for(let attempt=0;attempt<50;attempt++){try{if((await fetch(base+'/api/?route=/health')).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,50));}
 let browser;
 try{browser=await chromium.launch();const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});const page=await context.newPage();page.setDefaultTimeout(10000);page.setDefaultNavigationTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const api=async(route,body,token)=>{const response=await context.request.fetch(base+'/api/?route='+encodeURIComponent(route),{method:body?'POST':'GET',data:body,headers:token?{Authorization:'Bearer '+token}:{}});const data=await response.json();assert(response.ok(),JSON.stringify(data));return data;};
 const manager=(await api('/login',{role:'manager',password:managerPassword})).token;
 const initial=await api('/manager/catalog',null,manager);initial.catalog.locations=[{id:'north',name:'North',address:'123 Example Street',active:true},{id:'west',name:'West',address:'456 Example Street',active:true}];await api('/manager/catalog',initial,manager);
 await page.goto(base+'/auth/');await page.getByLabel('Password',{exact:true}).fill(managerPassword);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.goto(base+'/settings/');
 const north=page.locator('[data-location-id=north]');await north.getByLabel('Allow customer cancellation').check();await north.getByLabel('Window (minutes)').fill('6');await page.getByRole('button',{name:'Save business details',exact:true}).click();await page.locator('#business-message').filter({hasText:'Saved.'}).waitFor();await page.reload();assert.equal(await north.getByLabel('Window (minutes)').inputValue(),'6');assert.equal(await page.locator('[data-location-id=west]').getByLabel('Allow customer cancellation').isChecked(),false);
 await page.goto(base);await page.waitForFunction(()=>document.querySelector('dyws-ordering')?.catalog);
 await page.locator('.dyws-item-add').first().click();await page.locator('dyws-ordering').getByRole('button',{name:/Your order/}).click();await page.getByRole('button',{name:'Checkout'}).click();
 const ordering=page.locator('dyws-ordering');await ordering.locator('[name=customer]').fill('Fictional Cancel Guest');await ordering.locator('[name=phone]').fill('7805550100');await ordering.getByRole('button',{name:'Add tip',exact:true}).click();await ordering.locator('[name=tipDollars]').fill('11');
 for(const width of [320,390,1280]){await page.setViewportSize({width,height:900});assert(await ordering.locator('dialog').evaluate(d=>d.scrollWidth<=d.clientWidth+1));const style=await ordering.getByRole('button',{name:'Review order',exact:true}).evaluate(b=>({height:b.getBoundingClientRect().height,radius:getComputedStyle(b).borderRadius}));assert(style.height>=44);assert.equal(style.radius,'10px');}
 await ordering.getByRole('button',{name:'Review order',exact:true}).click();await ordering.getByRole('button',{name:'Pause automatic submission'}).click();assert.match(await ordering.locator('.dyws-cancellation-note').textContent(),/6 minutes/);
 // A legacy custom layout must not remove the policy notice.
 await ordering.getByRole('button',{name:'Back',exact:true}).click();await page.evaluate(async()=>{const c=document.querySelector('dyws-ordering');const {orderFields}=await import('/dyws/order-layout.js');c.plugins.orderLayout=stage=>({rows:orderFields[stage].required.length,fields:orderFields[stage].required.map((id,i)=>({id,row:i+1,column:1,span:2,align:'left',vertical:'top'}))});});
 await ordering.getByRole('button',{name:'Review order',exact:true}).click();await ordering.getByRole('button',{name:'Pause automatic submission'}).click();assert.equal(await ordering.locator('.dyws-cancellation-note').isVisible(),true);
 for(const scheme of ['light','dark']){await page.emulateMedia({colorScheme:scheme});await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(screenshots,'cancel-review-'+scheme+'.png')});}
 await ordering.getByRole('button',{name:'Place order'}).click();await page.waitForURL('**/tracking/?order=*');const id=new URL(page.url()).searchParams.get('order');await page.getByRole('button',{name:'Cancel order',exact:true}).waitFor();
 await api('/manager/orders/'+id+'/payment',{kind:'capture'},manager);await page.reload();await page.getByRole('button',{name:'Cancel order',exact:true}).click();await page.getByRole('button',{name:'Keep order',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Keep order',exact:true}).evaluate(e=>e===document.activeElement),true);assert.match(await page.locator('.dyws-cancel-refund').textContent(),/Full refund: .*including tip/);await page.getByRole('button',{name:'Keep order',exact:true}).click();
 await page.getByRole('button',{name:'Cancel order',exact:true}).click();
 for(const width of [320,390,1280]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.documentElement.style.fontSize='34px');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(screenshots,'cancel-confirm-large-text.png'),fullPage:true});await page.evaluate(()=>document.documentElement.style.fontSize='');
 await page.getByRole('button',{name:'Confirm cancellation',exact:true}).focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('.dyws-cancel-note')?.textContent==='Test payment refunded.');await page.reload();await page.getByText('Test payment refunded.',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Cancel order',exact:true}).isVisible(),false);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({settings:'passed',perLocation:'passed',review:'passed',customLayout:'passed',keyboard:'passed',fullRefund:'passed',reload:'passed',widths:[320,390,1280],largeText:'passed',errors}));
 }finally{await browser?.close();server.kill();await new Promise(resolve=>server.once('exit',resolve));fs.rmSync(fixture,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exit(1)});
