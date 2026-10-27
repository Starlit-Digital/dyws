const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const {spawn,execFileSync}=require('node:child_process');
(async()=>{
 const root=path.resolve(__dirname,'..'),fixture=fs.mkdtempSync(path.join(os.tmpdir(),'dyws-tip-browser-'));
 execFileSync('php',[path.join(root,'server/setup.php'),fixture]);
 const config=JSON.parse(fs.readFileSync(path.join(fixture,'config.json'),'utf8'));
 const catalog=JSON.parse(fs.readFileSync(config.catalog,'utf8'));catalog.locations=[{id:'north',name:'North Example Store',address:'100 Fictional Avenue, Edmonton, AB',phone:'7805550100',active:true},{id:'west',name:'West Example Store',address:'200 Fictional Avenue, Edmonton, AB',phone:'7805550100',active:true}];catalog.locationHours=null;catalog.orderingHours=null;fs.writeFileSync(config.catalog,JSON.stringify(catalog));
 const hash=require('node:crypto').createHash('sha256').update(config.tenant).digest('hex').slice(0,16);fs.writeFileSync(path.join(fixture,'maps-'+hash+'.json'),JSON.stringify({enabled:true,browserKey:'fictional_test_key_only_12345',mapId:'DEMO_MAP_ID'}));
 const access=fs.readFileSync(path.join(fixture,'LOCAL-ACCESS.txt'),'utf8');
 const managerPassword=access.match(/Manager password: (.+)/)[1],driverPassword=access.match(/Driver password: (.+)/)[1];
 const socket=net.createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
 const server=spawn('php',['-S',`127.0.0.1:${port}`,'-t',path.join(root,'public_html'),path.join(root,'server/router.php')],{env:{...process.env,DYWS_CONFIG:path.join(fixture,'config.json')},stdio:'ignore'});
 const base=`http://127.0.0.1:${port}`,screenshots=process.env.DYWS_PICKUP_SCREENSHOTS||fixture;fs.mkdirSync(screenshots,{recursive:true});
 for(let attempt=0;attempt<50;attempt++){try{if((await fetch(base+'/api/?route=/health')).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,50));}
 let browser;
 try{browser=await chromium.launch();const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});const page=await context.newPage();page.setDefaultTimeout(10000);page.setDefaultNavigationTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const api=async(route,body,token)=>{const response=await context.request.fetch(base+'/api/?route='+encodeURIComponent(route),{method:body?'POST':'GET',data:body,headers:token?{Authorization:'Bearer '+token}:{}});const data=await response.json();assert(response.ok(),JSON.stringify(data));return data;};
 // Use the real Google plugin with a local SDK double. No paid API or GPS calls.
 await page.addInitScript(()=>{
  window.testRoutes=[];window.testGPSCalls=0;navigator.geolocation.getCurrentPosition=()=>{window.testGPSCalls++;};
  const libraries={maps:{Map:class{constructor(canvas){canvas.style.background='#dce8db';canvas.textContent='Test map preview';}fitBounds(){}}},marker:{AdvancedMarkerElement:class{constructor(options){Object.assign(this,options);}}},core:{LatLngBounds:class{extend(){}}},routes:{Route:{computeRoutes:async request=>{window.testRoutes.push(request);return {routes:[{path:[{lat:1,lng:2},{lat:2,lng:3}],createPolylines:()=>[{setOptions(){},setMap(){}}]}]};}}}};
  window.google={maps:{importLibrary:async name=>libraries[name]}};
 });
 await page.goto(base);await page.waitForFunction(()=>document.querySelector('dyws-ordering')?.catalog);
 await page.locator('.dyws-item-add').first().click();await page.locator('dyws-ordering').getByRole('button',{name:/Your order/}).click();await page.getByRole('button',{name:'Continue to checkout'}).click();
 const ordering=page.locator('dyws-ordering');await ordering.locator('[name=customer]').fill('Fictional Pickup Guest');await ordering.locator('[name=phone]').fill('7805550100');
 const schedule=ordering.getByRole('checkbox',{name:'Schedule pickup'}),origin=ordering.locator('[name=pickupOrigin]');assert.equal(await schedule.isChecked(),false);
 await origin.fill('123 Fictional Street, Edmonton, AB');await page.waitForFunction(()=>window.testRoutes.length===1);assert.equal((await page.evaluate(()=>window.testRoutes.at(-1))).destination,catalog.locations[0].address);
 await ordering.locator('[name=locationId]').selectOption('west');await page.waitForFunction(()=>window.testRoutes.length===2);assert.equal((await page.evaluate(()=>window.testRoutes.at(-1))).destination,catalog.locations[1].address);
 await origin.fill('456 Fictional Street, Edmonton, AB');await page.waitForFunction(()=>window.testRoutes.length===3);assert.match((await page.evaluate(()=>window.testRoutes.at(-1))).origin,/456/);
 await origin.fill('');await page.waitForTimeout(800);assert.equal(await page.evaluate(()=>window.testRoutes.length),3);assert.equal(await ordering.locator('.dyws-pickup-map').isVisible(),false);
 await origin.fill('456 Fictional Street, Edmonton, AB');await schedule.check();assert.deepEqual(await ordering.locator('[name=pickupMinute] option').evaluateAll(options=>options.map(o=>o.value)),['','00','15','30','45']);
 const date=new Date(Date.now()+86400000).toISOString().slice(0,10);await ordering.locator('[name=pickupDate]').fill(date);await ordering.locator('[name=pickupHour]').selectOption('12');await ordering.locator('[name=pickupMinute]').selectOption('15');
 await ordering.getByRole('button',{name:'Add tip',exact:true}).click();await ordering.locator('[name=tipDollars]').fill('4');
 for(const width of [320,390,1280]){await page.setViewportSize({width,height:900});await schedule.scrollIntoViewIfNeeded();assert(await ordering.locator('dialog').evaluate(d=>d.scrollWidth<=d.clientWidth+1),`Checkout overflow at ${width}`);await page.screenshot({path:path.join(screenshots,`pickup-${width}.png`)});}
 await ordering.getByRole('button',{name:'Review order',exact:true}).click();await ordering.getByRole('button',{name:'Pause automatic submission'}).click();const meta=ordering.locator('.dyws-final-review [data-dyws-fulfillment]');assert.equal(await meta.getAttribute('data-order-type'),'scheduled_pickup');assert.equal(await meta.getAttribute('data-pickup-date'),date);assert.match(await meta.textContent(),/12:15/);await page.screenshot({path:path.join(screenshots,'pickup-review.png')});
 await ordering.getByRole('button',{name:'Back',exact:true}).click();assert.equal(await schedule.isChecked(),true);assert.equal(await ordering.locator('[name=pickupDate]').inputValue(),date);
 await ordering.locator('.dyws-fulfillment label').filter({hasText:'Delivery'}).click();assert.equal(await schedule.isVisible(),false);assert.equal(await ordering.locator('[name=pickupDate]').isEnabled(),false);await ordering.locator('.dyws-fulfillment label').filter({hasText:'Pickup'}).click();assert.equal(await schedule.isChecked(),true);
 // Old custom layouts cannot discard pickup controls or the review metadata.
 await page.evaluate(async()=>{const c=document.querySelector('dyws-ordering');const {orderFields}=await import('/dyws/order-layout.js');c.plugins.orderLayout=stage=>({rows:orderFields[stage].required.length,fields:orderFields[stage].required.map((id,i)=>({id,row:i+1,column:1,span:2,align:'left',vertical:'top'}))});});
 await ordering.getByRole('button',{name:'Back',exact:true}).click();await ordering.getByRole('button',{name:'Continue to checkout'}).click();await ordering.locator('[name=pickupDate]').waitFor({state:'visible'});assert.equal(await ordering.locator('[name=pickupDate]').inputValue(),date);assert.equal(await origin.inputValue(),'456 Fictional Street, Edmonton, AB');
 const preview=await api('/pickup/preview',{locationId:'west',pickupSchedule:{date,time:'12:15'}});assert.equal(preview.localDate,date);assert.equal(preview.timeZone,'America/Edmonton');
 await ordering.getByRole('button',{name:'Review order',exact:true}).click();await ordering.getByRole('button',{name:/Pause automatic submission|Resume countdown/}).click();assert.equal(await meta.getAttribute('data-pickup-at'),preview.scheduledAtUtc);
 await ordering.getByRole('button',{name:'Looks good! Send order now'}).click();await page.waitForURL('**/tracking/?order=*');const id=new URL(page.url()).searchParams.get('order');assert.equal(await page.locator('[data-dyws-fulfillment]').getAttribute('data-pickup-date'),date);assert.match(await page.locator('.dyws-tracking-totals').textContent(),/Tip\$4\.00/);
 const manager=(await api('/login',{role:'manager',password:managerPassword})).token;const saved=(await api('/manager/orders',null,manager)).orders.find(o=>o.id===id);assert.deepEqual(saved.fulfillmentMeta,preview);assert.equal(saved.tip,400);assert.equal(saved.address,'');assert(!JSON.stringify(saved).includes('456 Fictional'));
 const bad=await context.request.post(base+'/api/?route=/pickup/preview',{data:{locationId:'west',pickupSchedule:{date:'2000-01-01',time:'12:15'}}});assert.equal(bad.status(),422);
 await page.evaluate(token=>sessionStorage.setItem('dyws-manager',token),manager);await page.goto(base+'/auth/');await page.getByLabel('Password',{exact:true}).fill(managerPassword);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.locator('[data-open-order]').first().waitFor();assert.match(await page.locator('[data-order-id]').first().textContent(),/Scheduled pickup/);await page.locator('[data-open-order]').first().click();assert.equal(await page.locator('[data-order-content] [data-dyws-fulfillment]').getAttribute('data-pickup-date'),date);
 assert.equal(await page.evaluate(()=>window.testGPSCalls),0);assert.deepEqual(errors,[]);console.log(JSON.stringify({pickup:'passed',routeUpdates:'passed',scheduleMetadata:'passed',tracking:'passed',staff:'passed',customLayouts:'passed',widths:[320,390,1280],errors}));
 }finally{await browser?.close();server.kill();await new Promise(resolve=>server.once('exit',resolve));fs.rmSync(fixture,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exit(1)});
