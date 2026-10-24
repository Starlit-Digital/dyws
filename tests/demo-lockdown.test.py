"""Public demo policies: real HTTP, isolated SQLite, private configuration failures."""
import http.cookiejar,json,os,pathlib,re,shutil,socket,sqlite3,subprocess,tempfile,time,urllib.request,urllib.error,urllib.parse,uuid
root=pathlib.Path(__file__).resolve().parents[1]
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
  check(len(request('/driver/orders',token=driver)['orders'])==2)
  manifest=request('/plugins');check([p['id'] for p in manifest['plugins']]==['demo-lockdown','order-reporting','datatables'])
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
  order={'idempotencyKey':str(uuid.uuid4()),'customer':{'name':'DO NOT STORE THIS','phone':'7805550199'},'address':'DO NOT STORE THIS','notes':'DO NOT STORE THIS','pluginData':{'test':{'private':'DO NOT STORE THIS'}},'fulfillment':'delivery','demoAcknowledged':True,'lines':[{'id':'breakfast0','quantity':1,'price':1}]}
  receipt=request('/orders',order,status=201);oid=receipt['id'];check(receipt['paymentProvider']=='demo' and receipt['total']>1495)
  check(request('/orders',order,status=201)['id']==oid)
  request('/tracking/'+oid,status=404)
  check(request('/tracking/'+oid,tracking=receipt['trackingToken'])['status']=='placed')
  row=db.execute('SELECT customer_name,customer_phone,address,notes,plugin_data_json FROM orders WHERE id=?',(oid,)).fetchone()
  check('DO NOT STORE THIS' not in str(row) and row[0]=='Demo Customer' and '123 Example Avenue' in row[2])
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
  # Retention removes child records too, without breaking foreign key constraints.
  db.execute('UPDATE orders SET created_at=? WHERE id=?',(int(time.time())-90000,oid));db.commit()
  request('/health');check(db.execute('SELECT count(*) FROM orders WHERE id=?',(oid,)).fetchone()[0]==0)
  check(db.execute('SELECT count(*) FROM payments WHERE order_id=?',(oid,)).fetchone()[0]==0)
  # Required policy survives an attempted state-file deactivation.
  state=next(work.glob('plugins-*.json'));saved=state.read_text();state.write_text(json.dumps({'active':[],'known':['demo-lockdown','google-maps','stripe','datatables','order-reporting']}))
  check(request('/plugins')['plugins'][0]['id']=='demo-lockdown');request('/manager/password',{},manager,status=403)
  state.write_text(saved)
  # Missing files and registration failures cannot silently turn protection off.
  entry=work/'plugins/demo-lockdown/plugin.php';source=entry.read_text();entry.unlink()
  request('/health',status=503);request('/login',{'role':'manager','password':'admin'},status=503)
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
