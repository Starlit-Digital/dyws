"""Public demo policies: real HTTP, isolated SQLite, private configuration failures."""
import hashlib,http.cookiejar,json,os,pathlib,re,shutil,socket,sqlite3,subprocess,tempfile,time,urllib.request,urllib.error,urllib.parse,uuid
root=pathlib.Path(__file__).resolve().parents[1]
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args):return None
with tempfile.TemporaryDirectory(prefix='dyws-lockdown-') as temp:
 work=pathlib.Path(temp)/'private'
 with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
 base=f'http://127.0.0.1:{port}'
 subprocess.run(['php',str(root/'plugins/demo-lockdown/setup.php'),str(work),base],check=True,capture_output=True)
 assert subprocess.run(['php',str(root/'plugins/demo-lockdown/setup.php'),str(work),base],capture_output=True).returncode!=0
 config=json.loads((work/'config.json').read_text());assert 'drivers' not in config and 'manager_password_hash' not in config
 # Use a private copy so destructive failure tests never modify the checkout.
 shutil.copytree(root/'plugins',work/'plugins');config['plugins_path']=str(work/'plugins');(work/'config.json').write_text(json.dumps(config))
 db=sqlite3.connect(config['database'])
 server=subprocess.Popen(['php','-d','opcache.enable=0','-S',f'127.0.0.1:{port}','-t',str(root/'public_html'),str(root/'server/router.php')],env={**os.environ,'DYWS_CONFIG':str(work/'config.json')},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 checks=0
 def check(value):
  global checks
  assert value;checks+=1
 def request(route,body=None,token=None,tracking=None,status=200):
  global checks
  headers={'Content-Type':'application/json'}
  if token:headers['Authorization']='Bearer '+token
  if tracking:headers['X-Tracking-Token']=tracking
  req=urllib.request.Request(base+'/api/?route='+urllib.parse.quote(route,safe='/'),data=None if body is None else json.dumps(body).encode(),headers=headers)
  try:r=urllib.request.urlopen(req,timeout=5)
  except urllib.error.HTTPError as e:r=e
  with r:code=r.status;data=json.load(r)
  assert code==status,(route,code,data);checks+=1;return data
 def page_request(path,cookie='',method='GET'):
  req=urllib.request.Request(base+path,headers={'Cookie':cookie} if cookie else {},method=method)
  try:r=urllib.request.build_opener(NoRedirect()).open(req,timeout=5)
  except urllib.error.HTTPError as e:r=e
  with r:return r.status,r.headers,r.read().decode()
 try:
  for _ in range(50):
   try:request('/health');break
   except OSError:time.sleep(.05)
  request('/manager/orders',status=401)
  request('/login',{'role':'manager','password':'admin'},status=401)
  request('/login',{'role':'manager','username':'admin','password':'wrong'},status=401)
  manager=request('/login',{'role':'manager','username':'admin','password':'admin'})['token']
  driver=request('/login',{'role':'driver','driverId':'driver','password':'driver'})['token']
  request('/manager/orders',token=driver,status=403)
  profile=request('/driver/profile',token=driver);check(profile['profileIcon']=='car')
  profile=request('/driver/profile',{'profileIcon':'bicycle','vehicleType':'City bicycle','vehicleColor':'Teal','revision':profile['revision']},driver);check(profile['profileIcon']=='bicycle' and profile['vehicleType']=='City bicycle' and profile['vehicleColor']=='Teal')
  request('/driver/profile',{'profileIcon':'car','revision':profile['revision']},manager,status=403)
  request('/driver/profile',{'profileIcon':'bad','revision':profile['revision']},driver,status=422)
  check(len(request('/driver/orders',token=driver)['orders'])==2)
  manifest=request('/plugins');check([p['id'] for p in manifest['plugins']]==['demo-lockdown','order-reporting','datatables','nominatim','catalog','pickup','delivery'])
  check(request('/plugins/nominatim/config')['demo'] is True)
  check(request('/plugins/nominatim/search',{'query':'DO NOT FORWARD THIS'})['results'][0]['line1']=='123 Example Avenue NW')
  request('/manager/plugins/nominatim/settings',{'enabled':False,'revision':'demo'},manager,status=403)
  check(request('/manager/plugins',token=manager)['plugins'][0] is not None)
  check(next(p for p in request('/manager/plugins',token=manager)['plugins'] if p['id']=='demo-lockdown')['locked'])
  for route in ['/manager/settings','/manager/catalog','/manager/drivers','/manager/password','/manager/plugins','/manager/maps','/manager/stripe','/manager/plugins/google-maps/settings','/manager/plugins/stripe/settings','/plugins/stripe/webhook','/future/admin/change']:
   request(route,{'id':'demo-lockdown','active':False},manager,status=403)
  for route in ['/maps/config','/plugins/google-maps/config','/manager/maps','/manager/stripe','/manager/plugins/stripe/settings','/manager/plugins/google-maps/settings']:
   request(route,token=manager,status=403)
  # Browser forms support the same easy credentials and preserve CSRF checks.
  browser=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
  with browser.open(base+'/auth/') as r:
   html=r.read().decode();check('name="username"' in html and '<header' not in html)
   csrf=re.search('name="csrf" value="([a-f0-9]+)"',html)[1]
  with browser.open(urllib.request.Request(base+'/auth/',data=urllib.parse.urlencode({'csrf':csrf,'username':'admin','password':'admin'}).encode())) as r:
   html=r.read().decode();check(r.url.endswith('/orders/') and 'Demo Customer' in html)
  for page in ['catalog','settings','drivers','password','plugins','reports']:
   with browser.open(base+'/'+page+'/') as r:check(r.status==200 and 'demo-lockdown' in r.read().decode())
  with urllib.request.urlopen(base+'/driver/') as r:check('value="driver"' in r.read().decode())
  # The precise run allowlist keeps core authentication and rejects adjacent endpoints.
  request('/manager/runs',{},status=401)
  request('/manager/runs',{},driver,status=403)
  for route in ['/manager/runs/RUN-ABCDEF123456/delete','/driver/runs/RUN-ABCDEF123456/settings','/driver/runs/RUN-ABCDEF123456/location/device','/manager/runs/invalid']:
   request(route,{},manager,status=403)
  seed_ids=[o['id'] for o in request('/driver/orders',token=driver)['orders']]
  draft={'driverId':'driver','orderIds':seed_ids,'idempotencyKey':str(uuid.uuid4())}
  run=request('/manager/runs',draft,manager);rid=run['id']
  db.executemany("INSERT INTO delivery_runs(tenant,id,driver_id,status,request_key,revision,created_at,updated_at) VALUES(?,?,?,'cancelled',?,1,?,?)",[(config['tenant'],f'CAP-{i}','driver',f'cap-request-{i}',int(time.time()),int(time.time())) for i in range(499)]);db.commit()
  request('/manager/runs',{**draft,'idempotencyKey':str(uuid.uuid4())},manager,status=429)
  check(request('/manager/runs',draft,manager)['id']==rid)
  db.execute("DELETE FROM delivery_runs WHERE id LIKE 'CAP-%'");db.commit()
  request('/manager/runs/'+rid,{'action':'cancel','revision':run['revision']},manager)
  # Expired cancelled run history is bounded independently from retained orders.
  db.execute('UPDATE delivery_runs SET created_at=? WHERE id=?',(int(time.time())-90000,rid));db.commit()
  request('/health');check(db.execute('SELECT count(*) FROM delivery_runs WHERE id=?',(rid,)).fetchone()[0]==0)
  draft['idempotencyKey']=str(uuid.uuid4());run=request('/manager/runs',draft,manager);rid=run['id']
  seed_ids.reverse()
  run=request('/manager/runs/'+rid,{'action':'reorder','orderIds':seed_ids,'revision':run['revision']},manager)
  request('/driver/runs/'+rid+'/start',{},manager,status=403)
  request('/driver/runs/'+rid+'/start',{},driver)
  sharing=request('/driver/runs/'+rid+'/location/start',{'source':'device'},driver)
  check(sharing['source']=='simulated')
  request('/driver/runs/'+rid+'/location',{'latitude':1,'longitude':2,'accuracy':3,'recordedAt':int(time.time()),'sharingToken':sharing['sharingToken']},driver)
  check(all(db.execute('SELECT latitude,longitude FROM locations WHERE order_id=?',(oid,)).fetchone()==(53.61665,-113.39804) for oid in seed_ids))
  request('/driver/runs/'+rid+'/location/heartbeat',{'sharingToken':sharing['sharingToken']},driver)
  # Expiring the next active stop advances the run without leaking or stranding GPS.
  db.execute('UPDATE orders SET created_at=? WHERE id=?',(int(time.time())-90000,seed_ids[0]));db.commit()
  request('/health');remaining=request('/driver/orders',token=driver)['runs'][0]
  check(remaining['nextOrderId']==seed_ids[1] and remaining['stops'][0]['position']==1)
  check(db.execute('SELECT count(*) FROM locations WHERE order_id=?',(seed_ids[0],)).fetchone()[0]==0)
  request('/driver/orders/'+seed_ids[1]+'/status',{'status':'delivered'},driver)
  check(request('/driver/orders',token=driver)['runs']==[])
  db.execute('UPDATE orders SET created_at=? WHERE id=?',(int(time.time())-90000,seed_ids[1]));db.commit()
  request('/health');check(db.execute('SELECT count(*) FROM delivery_runs WHERE id=?',(rid,)).fetchone()[0]==0)
  check(db.execute('PRAGMA foreign_key_check').fetchall()==[])
  order={'idempotencyKey':str(uuid.uuid4()),'customer':{'name':'DO NOT STORE THIS','phone':'7805550199','email':'do-not-store@example.test'},'address':'DO NOT STORE THIS','notes':'DO NOT STORE THIS','pluginData':{'test':{'private':'DO NOT STORE THIS'}},'fulfillment':'delivery','demoAcknowledged':True,'lines':[{'id':'breakfast0','quantity':1,'price':1}]}
  receipt=request('/orders',order,status=201);oid=receipt['id'];check(receipt['paymentProvider']=='demo' and receipt['total']>1495)
  check(request('/orders',order,status=201)['id']==oid)
  request('/tracking/'+oid,status=404)
  check(request('/tracking/'+oid,tracking=receipt['trackingToken'])['status']=='placed')
  # Cancellation is allowed through lockdown, with capability and policy enforced by core.
  request('/tracking/'+oid+'/cancel',{},status=404)
  request('/tracking/'+oid+'/cancel',{},tracking=receipt['trackingToken'],status=409)
  request('/tracking/'+oid+'/cancel/refund',{},tracking=receipt['trackingToken'],status=403)
  # Admin can preview a different browser's order using its existing tracking capability.
  handoff='/plugins/demo-lockdown/tracking.php?order='+oid
  before=db.execute('SELECT tracking_hash,tracking_expires FROM orders WHERE id=?',(oid,)).fetchone()
  for cookie in ['', 'dyws_driver_session='+driver, 'dyws_admin_session='+driver, 'dyws_admin_session='+'0'*64]:
   code,headers,body=page_request(handoff,cookie);check(code==302 and headers['Location']=='/auth/' and 'dyws_track_' not in headers.get('Set-Cookie',''))
  foreign_token='c'*64
  db.execute('INSERT INTO sessions VALUES(?,?,?,?,?)',(hashlib.sha256(foreign_token.encode()).hexdigest(),'other-tenant','manager','admin',int(time.time())+900));db.commit()
  check(page_request(handoff,'dyws_admin_session='+foreign_token)[0]==302)
  admin_cookie='dyws_admin_session='+manager
  code,headers,body=page_request(handoff,admin_cookie)
  check(code==303 and headers['Location']=='/tracking/?order='+oid and not body)
  cookie=headers['Set-Cookie'];check('dyws_track_'+oid+'='+receipt['trackingToken'] in cookie and 'HttpOnly' in cookie and 'SameSite=Lax' in cookie and 'path=/tracking/' in cookie)
  check('no-store' in headers['Cache-Control'] and headers['Referrer-Policy']=='no-referrer' and receipt['trackingToken'] not in headers['Location'])
  check(db.execute('SELECT tracking_hash,tracking_expires FROM orders WHERE id=?',(oid,)).fetchone()==before)
  # This browser did not place the order and initially has no customer access.
  try:browser.open(base+'/tracking/?order='+oid)
  except urllib.error.HTTPError as e:check(e.code==404)
  else:raise AssertionError('Tracking opened without its capability')
  with browser.open(base+handoff) as r:
   html=r.read().decode();check(r.url==base+'/tracking/?order='+oid and 'Order received' in html and oid in html)
  check(page_request('/tracking/?order='+oid)[0]==404)
  check(page_request(handoff,admin_cookie,'POST')[0]==405)
  for suffix in ['','bad','DYWS-000000000099']:
   code,headers,_=page_request('/plugins/demo-lockdown/tracking.php?order='+suffix,admin_cookie);check(code==404 and 'dyws_track_' not in headers.get('Set-Cookie',''))
  check(page_request('/plugins/demo-lockdown/tracking.php?order[]=bad',admin_cookie)[0]==404)
  # The same manager cannot acquire another tenant's tracking capability.
  cur=db.execute('SELECT * FROM orders WHERE id=?',(oid,));foreign=dict(zip([d[0] for d in cur.description],cur.fetchone()));foreign.update(id='DYWS-FFFFFFFFFFFF',tenant='other-tenant')
  db.execute('INSERT INTO orders('+','.join(foreign)+') VALUES('+','.join('?' for _ in foreign)+')',list(foreign.values()));db.commit()
  check(page_request('/plugins/demo-lockdown/tracking.php?order='+foreign['id'],admin_cookie)[0]==404)
  db.execute('UPDATE orders SET tracking_expires=? WHERE id=?',(int(time.time())-1,oid));db.commit()
  code,headers,_=page_request(handoff,admin_cookie);check(code==404 and 'dyws_track_' not in headers.get('Set-Cookie',''))
  db.execute('UPDATE orders SET tracking_expires=?,tracking_hash=? WHERE id=?',(before[1],'0'*64,oid));db.commit()
  check(page_request(handoff,admin_cookie)[0]==404)
  db.execute('UPDATE orders SET tracking_hash=? WHERE id=?',(before[0],oid));db.commit()
  row=db.execute('SELECT customer_name,customer_phone,address,notes,plugin_data_json,customer_email FROM orders WHERE id=?',(oid,)).fetchone()
  check('DO NOT STORE THIS' not in str(row) and row[0]=='Demo Customer' and '123 Example Avenue' in row[2] and row[5]=='demo.customer@example.test' and 'do-not-store@example.test' not in str(row))
  request('/manager/orders/'+oid+'/assign',{'driverId':'driver'},manager)
  request('/manager/orders/'+oid+'/payment',{'kind':'capture'},manager)
  for status in ['accepted','preparing','ready']:request('/manager/orders/'+oid+'/status',{'status':status},manager)
  request('/driver/orders/'+oid+'/status',{'status':'out_for_delivery'},driver)
  sharing=request('/driver/orders/'+oid+'/location/start',{'source':'device'},driver)
  check(sharing['source']=='simulated')
  request('/driver/orders/'+oid+'/location',{'latitude':1,'longitude':2,'accuracy':3,'recordedAt':int(time.time()),'sharingToken':sharing['sharingToken']},driver)
  check(db.execute('SELECT latitude,longitude FROM locations WHERE order_id=?',(oid,)).fetchone()==(53.61665,-113.39804))
  request('/driver/orders/'+oid+'/status',{'status':'delivered'},driver)
  check(request('/tracking/'+oid,tracking=receipt['trackingToken'])['status']=='delivered')
  # A planned run also expires without leaving a driver occupied forever.
  db.execute("UPDATE orders SET status='ready' WHERE id=?",(oid,));db.commit()
  planned=request('/manager/runs',{'driverId':'driver','orderIds':[oid],'idempotencyKey':str(uuid.uuid4())},manager)
  # Retention removes child records too, without breaking foreign key constraints.
  db.execute('UPDATE orders SET created_at=? WHERE id=?',(int(time.time())-90000,oid));db.commit()
  request('/health');check(db.execute('SELECT count(*) FROM orders WHERE id=?',(oid,)).fetchone()[0]==0)
  check(db.execute('SELECT count(*) FROM payments WHERE order_id=?',(oid,)).fetchone()[0]==0)
  check(db.execute('SELECT count(*) FROM delivery_runs WHERE id=?',(planned['id'],)).fetchone()[0]==0)
  check(db.execute('PRAGMA foreign_key_check').fetchall()==[])
  # Required policy survives an attempted state-file deactivation.
  state=next(work.glob('plugins-*.json'));saved=state.read_text();state.write_text(json.dumps({'active':[],'known':['demo-lockdown','google-maps','stripe','datatables','order-reporting']}))
  check(request('/plugins')['plugins'][0]['id']=='demo-lockdown');request('/manager/password',{},manager,status=403)
  state.write_text(saved)
  # Owner may enable the layout preview, while manager saving remains locked.
  approved=json.loads(saved);approved['active'].append('order-format');state.write_text(json.dumps(approved))
  check(not request('/plugins/order-format/layouts')['layouts'])
  request('/manager/plugins/order-format/templates',status=401)
  request('/manager/plugins/order-format/templates',token=driver,status=403)
  templates=request('/manager/plugins/order-format/templates',token=manager)
  request('/manager/plugins/order-format/templates',templates,manager,status=403)
  with browser.open(base+'/plugins/order-format/editor.php') as r:
   html=r.read().decode();check('data-order-format-active="true"' in html and 'data-order-format-locked="true"' in html)
  state.write_text(saved)
  # Missing files and registration failures cannot silently turn protection off.
  entry=work/'plugins/demo-lockdown/plugin.php';source=entry.read_text();entry.unlink()
  request('/health',status=503);request('/login',{'role':'manager','password':'admin'},status=503)
  check(page_request('/plugins/demo-lockdown/tracking.php?order='+oid,admin_cookie)[0]==503)
  try:urllib.request.urlopen(base+'/auth/')
  except urllib.error.HTTPError as e:check(e.code==503)
  else:raise AssertionError('Unprotected auth page')
  entry.write_text('<?php throw new RuntimeException("broken demo policy");')
  request('/health',status=503);entry.write_text(source)
  # A host configuration change cannot accidentally enable real payment or maps providers.
  bad=json.loads(saved);bad['active'].append('stripe');state.write_text(json.dumps(bad));request('/health',status=503);state.write_text(saved)
  request('/health')
  print(f'Public demo lockdown: {checks} checks passed.')
 finally:server.terminate();server.wait(timeout=5);db.close()
