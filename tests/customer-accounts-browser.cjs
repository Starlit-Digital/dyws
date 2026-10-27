const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const {spawn,execFileSync}=require('node:child_process');
(async()=>{
 const root=path.resolve(__dirname,'..'),fixture=fs.mkdtempSync(path.join(os.tmpdir(),'dyws-customer-browser-'));
 execFileSync('php',[path.join(root,'server/setup.php'),fixture]);
 const socket=net.createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
 const base=`http://127.0.0.1:${port}`,configPath=path.join(fixture,'config.json'),config=JSON.parse(fs.readFileSync(configPath,'utf8'));
 config.public_base_url=base;config.customer_accounts={enabled:true,from:'accounts@example.test'};fs.writeFileSync(configPath,JSON.stringify(config));
 const outbox=path.join(fixture,'outbox.txt'),mailer=path.join(fixture,'sendmail.sh');fs.writeFileSync(mailer,`#!/bin/sh\ncat > '${outbox}'\n`,{mode:0o700});
 const server=spawn('php',['-d','sendmail_path='+mailer,'-S',`127.0.0.1:${port}`,'-t',path.join(root,'public_html'),path.join(root,'server/router.php')],{env:{...process.env,DYWS_CONFIG:configPath},stdio:'ignore'});
 const shots=process.env.DYWS_CUSTOMER_SCREENSHOTS||fixture;fs.mkdirSync(shots,{recursive:true});let browser;
 try{
  for(let attempt=0;attempt<50;attempt++){try{if((await fetch(base+'/api/?route=/health')).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,50));}
  browser=await chromium.launch();const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const api=async(route,body,token,status=200)=>{const response=await context.request.fetch(base+'/api/?route='+encodeURIComponent(route),{method:body?'POST':'GET',data:body,headers:{'X-DYWS-Customer':'1',...(token?{Authorization:'Bearer '+token}:{})}});const data=await response.json();assert.equal(response.status(),status,JSON.stringify(data));return data;};
  await page.goto(base+'/account/');await page.getByLabel('Email',{exact:true}).fill('browser@example.test');await page.getByRole('button',{name:'Email me a sign in link'}).click();await page.getByText('Check your email for a sign in link. It expires in 15 minutes.').waitFor();
  const loginURL=fs.readFileSync(outbox,'utf8').match(/http:\/\/[^\s]+#login=[a-f0-9]{64}/)[0];await page.goto(loginURL);await page.getByRole('button',{name:'Continue as browser@example.test'}).waitFor();assert(!page.url().includes('#'));
  await page.getByRole('button',{name:'Continue as browser@example.test'}).click();await page.getByRole('heading',{name:'Order history'}).waitFor();assert.match(await page.locator('[data-account-message]').textContent(),/Signed in as browser@example.test/);
  // The normal checkout carries the authenticated customer session to order creation.
  await page.goto(base);await page.waitForFunction(()=>document.querySelector('dyws-ordering')?.catalog);
  await page.locator('.dyws-item-add').first().click();const ordering=page.locator('dyws-ordering');await ordering.getByRole('button',{name:/Your order/}).click();await ordering.getByRole('button',{name:'Checkout',exact:true}).click();await ordering.getByText('Order as browser@example.test. Saved to your account.').waitFor();
  await ordering.locator('[name=customer]').fill('Fictional Browser Customer');await ordering.locator('[name=phone]').fill('7805550142');await ordering.getByRole('button',{name:'Review order',exact:true}).click();await ordering.getByRole('button',{name:'Place order',exact:true}).click();await page.waitForURL('**/tracking/?order=*');
  const pickup=new URL(page.url()).searchParams.get('order');assert((await api('/customer/orders')).orders.some(o=>o.id===pickup));
  const body=()=>({idempotencyKey:require('node:crypto').randomUUID(),customer:{name:'Fictional Browser Customer',phone:'7805550142'},lines:[{id:'breakfast0',variant:'',quantity:1}],demoAcknowledged:true,fulfillment:'delivery',address:'123 Fictional Road, Edmonton'});
  const delivered=await api('/orders',body(),null,201),id=delivered.id;
  const managerPassword=fs.readFileSync(path.join(fixture,'LOCAL-ACCESS.txt'),'utf8').match(/Manager password: (.+)/)[1];const manager=(await api('/login',{role:'manager',password:managerPassword})).token;
  await api('/manager/orders/'+id+'/assign',{driverId:'demo-driver'},manager);await api('/manager/orders/'+id+'/payment',{kind:'capture'},manager);
  for(const status of ['accepted','preparing','ready','out_for_delivery','delivered'])await api('/manager/orders/'+id+'/status',{status},manager);
  await page.goto(base+'/account/');const card=page.locator('[data-order="'+id+'"]');await card.locator('summary').filter({hasText:'Report driver'}).click();await card.getByLabel('What went wrong?').selectOption('conduct');await card.getByLabel('Details (optional)').fill('Fictional customer report <script>unsafe()</script>');await card.getByRole('checkbox').check();await card.getByRole('button',{name:'Submit report'}).click();await page.getByText('Report submitted. This driver is blocked from your future deliveries at this store.',{exact:true}).waitFor();
  assert.equal(await page.locator('script').filter({hasText:'unsafe()'}).count(),0);await card.getByText('This driver is blocked for your account at this store.').waitFor();
  for(const width of [320,390,1280]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Account overflow at '+width);await page.screenshot({path:path.join(shots,`account-${width}.png`),fullPage:true});}
  await page.setViewportSize({width:390,height:900});await page.evaluate(()=>{document.documentElement.style.setProperty('--font-size','34px');document.body.style.setProperty('--dyws-font','34px/1.5 system-ui');});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Account overflow at 200% text');await page.screenshot({path:path.join(shots,'account-large-text.png'),fullPage:true});
  const future=await api('/orders',body(),null,201);const denial=await api('/manager/orders/'+future.id+'/assign',{driverId:'demo-driver'},manager,409);assert.equal(denial.code,'customer_blocked_driver');
  // Staff see the disabled option and a readable block reason, plus the report inbox.
  await page.goto(base+'/auth/');await page.getByLabel('Password',{exact:true}).fill(managerPassword);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/orders/');await page.goto(base+'/orders/#order='+future.id);await page.locator('.dyws-driver-select option[value="demo-driver"]').waitFor({state:'attached'});assert.equal(await page.locator('.dyws-driver-select option[value="demo-driver"]').getAttribute('disabled'),'');await page.getByText(/Blocked for this customer:/).waitFor();
  await page.getByText('Customer driver reports',{exact:true}).click();await page.getByText('Fictional customer report <script>unsafe()</script>',{exact:true}).waitFor();await page.screenshot({path:path.join(shots,'staff-block.png'),fullPage:true});
  await page.goto(base+'/account/');await page.getByRole('button',{name:'Unblock',exact:true}).click();await page.getByText('Driver unblocked. They can be assigned again.').waitFor();await api('/manager/orders/'+future.id+'/assign',{driverId:'demo-driver'},manager);
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByLabel('Email',{exact:true}).waitFor();assert.equal(await page.locator('[data-order]').count(),0);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({magicLink:'passed',checkoutOwnership:'passed',history:'passed',reportAndBlock:'passed',staffWarning:'passed',unblock:'passed',mobileAndLargeText:'passed',signout:'passed',screenshots:shots}));
 }finally{await browser?.close();server.kill();fs.rmSync(fixture,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exit(1);});
