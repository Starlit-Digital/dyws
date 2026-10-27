"""Customer identity, reporting and dispatch through real HTTP, with private local mail capture."""
import hashlib,http.cookiejar,json,os,pathlib,re,socket,sqlite3,subprocess,tempfile,time,urllib.request,urllib.error,urllib.parse,uuid

root=pathlib.Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='dyws-customer-test-') as work:
 work=pathlib.Path(work)
 subprocess.run(['php',str(root/'server/setup.php'),str(work)],check=True,capture_output=True)
 config_path=work/'config.json';cfg=json.loads(config_path.read_text())
 # Seed the preaccount order schema to verify an additive, repeatable migration.
 with sqlite3.connect(cfg['database']) as db:
  db.executescript((root/'modules/dyws/php/schema.sql').read_text())
  db.execute('INSERT INTO orders(id,tenant,request_key,fingerprint,tracking_hash,tracking_expires,status,payment_status,fulfillment,customer_name,customer_phone,address,notes,lines_json,subtotal,tax,total,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',('DYWS-EEEEEEEEEEEE',cfg['tenant'],'legacy-order-fixture','legacy-fingerprint','legacy-hash',2147483647,'completed','paid','pickup','Legacy Fictional Guest','7805550142','','Preserve this order','[]',100,5,105,1000,1000))
 access=(work/'LOCAL-ACCESS.txt').read_text();manager_password=re.search(r'Manager password: (.+)',access)[1]
 with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
 base=f'http://127.0.0.1:{port}';cfg['public_base_url']=base;config_path.write_text(json.dumps(cfg))
 outbox=work/'outbox.txt';mailer=work/'sendmail.sh';mailer.write_text('#!/bin/sh\ncat > "'+str(outbox)+'"\n');mailer.chmod(0o700)
 server=subprocess.Popen(['php','-d','sendmail_path='+str(mailer),'-S',f'127.0.0.1:{port}','-t',str(root/'public_html'),str(root/'server/router.php')],env={**os.environ,'DYWS_CONFIG':str(config_path)},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 jar=http.cookiejar.CookieJar();browser=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
 second_jar=http.cookiejar.CookieJar();second=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(second_jar));stranger=urllib.request.build_opener()
 checks=0;last_headers=None
 def req(route,body=None,status=200,client=browser,customer=True,extra=None):
  global checks,last_headers
  headers={'X-DYWS-Customer':'1'} if customer else {}
  if body is not None:headers['Content-Type']='application/json'
  headers.update(extra or {})
  request=urllib.request.Request(base+'/api/?route='+urllib.parse.quote(route.split('?')[0],safe='/')+('&'+route.split('?')[1] if '?' in route else ''),data=None if body is None else json.dumps(body).encode(),headers=headers)
  try:
   with client.open(request,timeout=10) as response:code=response.status;data=json.load(response);last_headers=response.headers
  except urllib.error.HTTPError as error:code=error.code;data=json.load(error);last_headers=error.headers
  assert code==status,(route,code,data,status);checks+=1;return data
 def sql(query,args=()):
  with sqlite3.connect(cfg['database']) as db:
   db.execute('PRAGMA foreign_keys=ON');return db.execute(query,args).fetchall()
 def link(email='customer@example.test',client=browser):
  req('/customer/auth/request',{'email':email},client=client)
  return re.search(r'#login=([a-f0-9]{64})',outbox.read_text())[1]
 def verify(token,client=browser):return req('/customer/auth/verify',{'token':token},client=client)
 def order(**changes):
  return {'idempotencyKey':str(uuid.uuid4()),'customer':{'name':'Fictional Customer','phone':'7805550142'},'lines':[{'id':'breakfast0','variant':'','quantity':1}],'demoAcknowledged':True,'fulfillment':'delivery','address':'123 Fictional Road, Edmonton',**changes}
 def admin(route,body=None,status=200):return req(route,body,status,client=stranger,extra={'Authorization':'Bearer '+manager})
 def ready(receipt,driver='demo-driver'):
  id=receipt['id']
  if driver:admin('/manager/orders/'+id+'/assign',{'driverId':driver})
  for status in ['accepted','preparing','ready']:admin('/manager/orders/'+id+'/status',{'status':status})
  admin('/manager/orders/'+id+'/payment',{'kind':'capture'})
  return id
 def delivered(receipt):
  id=ready(receipt)
  for status in ['out_for_delivery','delivered']:admin('/manager/orders/'+id+'/status',{'status':status})
  return id
 try:
  for _ in range(60):
   try:req('/health');break
   except (OSError,urllib.error.URLError):time.sleep(.05)
  else:raise AssertionError('Server did not start')
  assert req('/customer/session')['enabled'] is False
  assert sql('SELECT customer_id,total,notes FROM orders WHERE id=?',('DYWS-EEEEEEEEEEEE',))==[(None,105,'Preserve this order')]
  req('/customer/auth/request',{'email':'customer@example.test'},503)
  cfg['customer_accounts']={'enabled':True,'from':'accounts@example.test'};config_path.write_text(json.dumps(cfg))
  assert req('/customer/session')['enabled'] is True
  req('/customer/session',status=403,customer=False)
  req('/customer/auth/request',{'email':'customer@example.test'},403,extra={'Origin':'https://evil.example'})
  req('/customer/auth/request',{'email':'customer@example.test'},403,extra={'Sec-Fetch-Site':'cross-site'})
  req('/customer/auth/request',{'email':'bad\r\nBcc: victim@example.test'},422)
  req('/customer/orders',status=401)
  req('/customer/addresses',status=401)
  token=link(' Customer@Example.test ')
  assert not sql('SELECT * FROM customers')
  assert sql('SELECT token_hash,email FROM customer_links')==[(hashlib.sha256(token.encode()).hexdigest(),'customer@example.test')]
  with browser.open(base+'/account/') as response:
   html=response.read().decode();assert 'My account' in html and response.headers['Cache-Control']=='no-store' and response.headers['Referrer-Policy']=='no-referrer'
  assert req('/customer/auth/inspect',{'token':token})['email']=='customer@example.test'
  assert not sql('SELECT * FROM customers')
  verify(token)
  cookie=next(c for c in jar if c.name.startswith('dyws_customer_'));session_token=cookie.value
  assert cookie.has_nonstandard_attr('HttpOnly') and cookie.get_nonstandard_attr('SameSite')=='Lax' and cookie.path=='/'
  assert abs(cookie.expires-(int(time.time())+30*86400))<3
  assert sql('SELECT token_hash FROM customer_sessions')==[(hashlib.sha256(session_token.encode()).hexdigest(),)]
  req('/customer/auth/verify',{'token':token},410)
  state=req('/customer/session');cid=state['customer']['id'];assert state['customer']['email']=='customer@example.test'
  assert req('/customer/orders')['orders']==[]
  assert req('/customer/addresses')=={'addresses':[],'nextOffset':None}
  req('/customer/addresses',status=403,customer=False)
  req('/customer/addresses',status=403,extra={'Origin':'https://evil.example'})
  req('/customer/addresses?offset=bad',status=422)
  assert req('/customer/session',client=stranger)['customer'] is None
  # Customer sessions and staff bearer credentials never substitute for each other.
  req('/manager/orders',status=401)
  req('/manager/orders',status=401,extra={'Authorization':'Bearer '+session_token})
  manager=req('/login',{'role':'manager','password':manager_password})['token']
  req('/customer/orders',status=401,client=stranger,extra={'Authorization':'Bearer '+manager})
  # A supplied customer id or email has no ownership authority.
  guest_body=order(customerId=cid,customerAccountId=cid)
  req('/orders',guest_body,409,client=stranger)
  guest_body.pop('customerAccountId');guest=req('/orders',guest_body,201,client=stranger)
  assert sql('SELECT customer_id FROM orders WHERE id=?',(guest['id'],))[0][0] is None
  assert req('/customer/orders')['orders']==[]
  receipt_body=order(customerAccountRequired=True,customerAccountId=cid)
  req('/orders',receipt_body,403,customer=False)
  receipt=req('/orders',receipt_body,201)
  assert sql('SELECT customer_id FROM orders WHERE id=?',(receipt['id'],))[0][0]==cid
  assert req('/orders',receipt_body,201)['id']==receipt['id']
  assert len(req('/customer/orders')['orders'])==1
  address_id=sql('SELECT delivery_address_id FROM orders WHERE id=?',(receipt['id'],))[0][0]
  assert address_id.startswith('ADR-') and req('/customer/orders')['orders'][0]['deliveryAddressId']==address_id
  destinations=req('/customer/addresses')['addresses']
  assert len(destinations)==1 and destinations[0]['id']==address_id and destinations[0]['address']==receipt_body['address']
  assert destinations[0]['addressDetails']=={}
  assert sql('SELECT delivery_address_id FROM orders WHERE id=?',(guest['id'],))[0][0]==address_id
  req('/orders',receipt_body,401,client=stranger)
  req('/orders',order(customerAccountId='CUS-IMPERSONATED'),409)
  req('/customer/orders/'+receipt['id']+'/report',{'reason':'conduct','details':'Example'},409)
  old=delivered(receipt)
  # A verified second customer cannot read, claim, report or block this customer's delivery.
  verify(link('second@example.test',second),second)
  second_id=req('/customer/session',client=second)['customer']['id']
  assert req('/customer/orders',client=second)['orders']==[]
  assert req('/customer/addresses?customerId='+cid,client=second)['addresses']==[]
  req('/customer/orders/'+old+'/report',{'reason':'conduct'},404,client=second)
  req('/customer/orders/'+old+'/block',{},404,client=second)
  req('/customer/orders/'+old+'/claim',{},409,client=second,extra={'X-Tracking-Token':receipt['trackingToken']})
  req('/customer/orders/'+guest['id']+'/claim',{},404)
  req('/customer/orders/'+guest['id']+'/claim',{},extra={'X-Tracking-Token':guest['trackingToken']})
  assert len(req('/customer/orders')['orders'])==2
  assert len(req('/customer/addresses')['addresses'])==1
  # Prepare separate and grouped assignments before blocking, to exercise departure checks.
  assigned=ready(req('/orders',order(),201))
  run_order=ready(req('/orders',order(address='456 Other Fictional Avenue'),201))
  run=admin('/manager/runs',{'driverId':'demo-driver','orderIds':[run_order],'idempotencyKey':str(uuid.uuid4())})
  driver=req('/login',{'role':'driver','driverId':'demo-driver','password':re.search(r'Driver password: (.+)',access)[1]})['token']
  report={'reason':'conduct','details':'Fictional report <script>alert(1)</script>','blockDriver':True}
  req('/customer/orders/'+old+'/report',{**report,'blockDriver':'yes'},422)
  req('/customer/orders/'+old+'/report',report)
  req('/customer/orders/'+old+'/report',report)
  assert len(sql('SELECT * FROM customer_driver_reports'))==1
  req('/customer/orders/'+old+'/report',{**report,'details':'Different'},409)
  assert req('/customer/blocks')['blocks'][0]['driverId']=='demo-driver'
  # All addresses and future deliveries for this account inherit the block.
  future=req('/orders',order(address='789 New Fictional Street'),201)
  denial=admin('/manager/orders/'+future['id']+'/assign',{'driverId':'demo-driver'},409)
  assert denial['code']=='customer_blocked_driver' and denial['context']=={'orderId':future['id'],'driverId':'demo-driver'}
  assert 'customer account has blocked' in denial['error']
  assert sql('SELECT driver_id FROM orders WHERE id=?',(future['id'],))[0][0] is None
  run_denial=req('/driver/runs/'+run['id']+'/start',{},409,client=stranger,extra={'Authorization':'Bearer '+driver})
  assert run_denial['code']=='customer_blocked_driver'
  assert sql('SELECT status FROM delivery_runs WHERE id=?',(run['id'],))[0][0]=='planned'
  admin('/manager/runs/'+run['id'],{'revision':run['revision'],'action':'cancel'})
  direct_denial=admin('/manager/orders/'+assigned+'/status',{'status':'out_for_delivery'},409)
  assert direct_denial['code']=='customer_blocked_driver'
  # A run rejection is atomic, even if an allowed stop was processed first.
  other=req('/orders',order(),201,client=second);other_ready=ready(other,driver=None)
  assert req('/customer/addresses',client=second)['addresses'][0]['id']==address_id
  assert sql('SELECT count(*) FROM customer_delivery_addresses WHERE address_id=?',(address_id,))[0][0]==2
  future_ready=ready(future,driver=None)
  before=sql('SELECT count(*) FROM delivery_runs')[0][0]
  admin('/manager/runs',{'driverId':'demo-driver','orderIds':[other_ready,future_ready],'idempotencyKey':str(uuid.uuid4())},409)
  assert sql('SELECT count(*) FROM delivery_runs')[0][0]==before
  assert sql('SELECT driver_id FROM orders WHERE id=?',(other_ready,))[0][0] is None
  # Different accounts and guests are not blocked based on shared address or name.
  admin('/manager/orders/'+other_ready+'/assign',{'driverId':'demo-driver'})
  unowned=req('/orders',order(),201,client=stranger)
  admin('/manager/orders/'+unowned['id']+'/assign',{'driverId':'demo-driver'})
  req('/customer/orders/'+unowned['id']+'/claim',{},409,extra={'X-Tracking-Token':unowned['trackingToken']})
  # Staff can see reports and blocked options. Public tracking and drivers cannot see reports or identities.
  board=admin('/manager/orders');blocked=next(o for o in board['orders'] if o['id']==assigned)
  assert blocked['blockedDriverIds']==['demo-driver'] and blocked['assignmentWarning']
  assert 'customer_id' not in blocked
  assert 'delivery_address_id' not in blocked
  reports=admin('/manager/customer-reports')['reports'];assert reports[0]['details']==report['details']
  req('/manager/customer-reports',status=401)
  req('/manager/customer-reports',status=403,client=stranger,extra={'Authorization':'Bearer '+driver})
  public=req('/tracking/'+old,extra={'X-Tracking-Token':receipt['trackingToken']})
  assert 'customer_id' not in public and 'driverReports' not in public and report['details'] not in json.dumps(public)
  assert 'deliveryAddressId' not in public and 'delivery_address_id' not in public
  driver_orders=req('/driver/orders',client=stranger,extra={'Authorization':'Bearer '+driver})
  assert 'customer_id' not in json.dumps(driver_orders) and 'driverReports' not in json.dumps(driver_orders)
  assert 'delivery_address_id' not in json.dumps(driver_orders)
  # Reports without blocks remain visible, but never prevent another account's dispatch.
  second_delivery=delivered(req('/orders',order(),201,client=second))
  req('/customer/orders/'+second_delivery+'/report',{'reason':'late','blockDriver':False},client=second)
  assert req('/customer/blocks',client=second)['blocks']==[]
  # Unblocking is customer scoped and preserves the report.
  req('/customer/blocks',{'action':'unblock','driverId':'demo-driver'},client=second)
  assert req('/customer/blocks')['blocks']
  req('/customer/blocks',{'action':'unblock','driverId':'demo-driver'})
  assert req('/customer/blocks')['blocks']==[] and len(admin('/manager/customer-reports')['reports'])==2
  admin('/manager/orders/'+future['id']+'/assign',{'driverId':'demo-driver'})
  req('/customer/orders/'+old+'/block',{})
  admin('/manager/orders/'+future['id']+'/assign',{'driverId':'demo-driver'},409)
  # Old tracking expiry does not truncate account history or prevent later reporting.
  sql('UPDATE orders SET tracking_expires=? WHERE id=?',(int(time.time())-1,old))
  req('/tracking/'+old,status=404,extra={'X-Tracking-Token':receipt['trackingToken']})
  history=req('/customer/orders');assert any(o['id']==old for o in history['orders'])
  assert all('tracking_hash' not in o and 'request_key' not in o and 'pluginData' not in o for o in history['orders'])
  req('/customer/orders?offset=bad',status=422)
  # Mailbox limit returns the same response and never creates an account.
  mailbox='limited@example.test'
  for _ in range(3):link(mailbox)
  before=outbox.read_text();reply=req('/customer/auth/request',{'email':mailbox});assert reply['accepted'] and outbox.read_text()==before
  assert not sql('SELECT * FROM customers WHERE email=?',(mailbox,))
  # Expired links fail; a returning verified email reuses its existing account.
  expired=link('expired@example.test');sql('UPDATE customer_links SET expires_at=1 WHERE email=?',('expired@example.test',))
  req('/customer/auth/verify',{'token':expired},410)
  returning=link();verify(returning);assert req('/customer/session')['customer']['id']==cid
  assert address_id in [a['id'] for a in req('/customer/addresses')['addresses']]
  assert not sql('SELECT 1 FROM customer_sessions WHERE token_hash=?',(hashlib.sha256(session_token.encode()).hexdigest(),))
  # Expired sessions cannot silently attach orders or access history.
  sql('UPDATE customer_sessions SET expires_at=1 WHERE customer_id=?',(cid,))
  req('/customer/orders',status=401)
  req('/orders',order(customerAccountRequired=True),401)
  req('/customer/auth/request',{'email':'rate-test@example.test'},429)
  sql('DELETE FROM limits')
  verify(link());new_cookie=next(c for c in jar if c.name.startswith('dyws_customer_'))
  raw_token=new_cookie.value;cookie_name=new_cookie.name
  # Tenant isolation also holds when someone supplies a forged cookie name for another tenant.
  cfg['tenant']='another-store';config_path.write_text(json.dumps(cfg))
  alternate_name='dyws_customer_'+hashlib.sha256((cfg['tenant']+'|'+base).encode()).hexdigest()[:16]
  assert req('/customer/session',extra={'Cookie':alternate_name+'='+raw_token})['customer'] is None
  req('/customer/addresses',status=401,extra={'Cookie':alternate_name+'='+raw_token})
  req('/customer/auth/verify',{'token':returning},410)
  cfg['tenant']='dyws-diner';config_path.write_text(json.dumps(cfg))
  req('/customer/logout',{},extra={'Origin':base})
  assert req('/customer/session')['customer'] is None
  req('/customer/orders',status=401,extra={'Cookie':cookie_name+'='+raw_token})
  assert len(sql('SELECT * FROM customers'))==2
  # Mail delivery failure revokes its token and reports a real setup error.
  mailer.write_text('#!/bin/sh\ncat > /dev/null\nexit 1\n')
  req('/customer/auth/request',{'email':'failure@example.test'},503)
  assert not sql('SELECT * FROM customer_links WHERE email=?',('failure@example.test',))
  # Secure cookies and installation path are derived only from trusted private configuration.
  mailer.write_text('#!/bin/sh\ncat > "'+str(outbox)+'"\n')
  # Reset only test throttles before testing a separate installation URL.
  sql('DELETE FROM limits')
  cfg['public_base_url']='https://restaurant.example/store';config_path.write_text(json.dumps(cfg))
  secure=link('secure@example.test');assert 'https://restaurant.example/store/account/#login=' in outbox.read_text()
  verify(secure);assert 'secure' in last_headers['Set-Cookie'].lower() and 'path=/store/' in last_headers['Set-Cookie'].lower()
  # Two independent SQLite connections race to redeem one link. Exactly one commits.
  cfg['public_base_url']=base;config_path.write_text(json.dumps(cfg))
  racing=link('race@example.test');gate=work/'redeem-gate'
  source=r"""require $argv[1]; [$config,$store]=dyws_app_bootstrap();
   file_put_contents($argv[2],'ready');$until=microtime(true)+5;
   while(!is_file($argv[3])&&microtime(true)<$until){usleep(1000);clearstatcache();}
   try{(new \dyws\CustomerAccounts($store,$config))->verify(['token'=>trim(stream_get_contents(STDIN))]);echo '200';}
   catch(\dyws\ApiError $e){echo $e->http;}"""
  workers=[]
  for n in range(2):
   workers.append(subprocess.Popen(['php','-r',source,str(root/'server/bootstrap.php'),str(work/f'ready-{n}'),str(gate)],env={**os.environ,'DYWS_CONFIG':str(config_path)},stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True))
  for _ in range(100):
   if all((work/f'ready-{n}').exists() for n in range(2)):break
   time.sleep(.02)
  assert all((work/f'ready-{n}').exists() for n in range(2))
  for worker in workers:worker.stdin.write(racing);worker.stdin.close();worker.stdin=None
  gate.touch();codes=[]
  for worker in workers:
   output,errors=worker.communicate(timeout=10);assert worker.returncode==0,(output,errors);codes.append(output)
  assert sorted(codes)==['200','410'] and len(sql('SELECT * FROM customers WHERE email=?',('race@example.test',)))==1
  # Pagination includes old receipts, stays bounded, and never crosses account ownership.
  columns=[row[1] for row in sql('PRAGMA table_info(orders)')]
  original=dict(zip(columns,sql('SELECT * FROM orders WHERE id=?',(old,))[0]))
  with sqlite3.connect(cfg['database']) as db:
   for n in range(25):
    row={**original,'id':'DYWS-'+f'{n:012X}','request_key':str(uuid.uuid4()),'created_at':1000+n}
    db.execute('INSERT INTO orders('+','.join(columns)+') VALUES('+','.join('?' for _ in columns)+')',[row[c] for c in columns])
  verify(link());first=req('/customer/orders');second_page=req('/customer/orders?offset=20')
  assert len(first['orders'])==20 and first['nextOffset']==20 and second_page['orders']
  ids=[o['id'] for o in first['orders']+second_page['orders']]
  assert len(ids)==len(set(ids))==sql('SELECT count(*) FROM orders WHERE customer_id=?',(cid,))[0][0]
  assert all(sql('SELECT customer_id FROM orders WHERE id=?',(id,))[0][0]==cid for id in ids)
  # Shared public demos never accept real email or customer reports.
  cfg['public_base_url']=base;cfg['demo_lockdown']=True;config_path.write_text(json.dumps(cfg))
  assert req('/customer/session')['enabled'] is False
  req('/customer/auth/request',{'email':'public@example.test'},503)
  admin('/manager/orders/'+future['id']+'/assign',{'driverId':'demo-driver'},409)
  assert sql('PRAGMA integrity_check')==[('ok',)] and sql('PRAGMA foreign_key_check')==[]
  print(f'Customer accounts and driver safety HTTP API: {checks} checks passed.')
 finally:server.terminate();server.wait(timeout=5)
