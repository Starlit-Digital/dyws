"""Remembered guest details through the real HTTP boundary, using fictional contacts."""
import hashlib,http.cookiejar,json,os,pathlib,socket,sqlite3,subprocess,tempfile,time,urllib.request,urllib.error,urllib.parse,uuid

root=pathlib.Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='dyws-guest-test-') as work:
 subprocess.run(['php',str(root/'server/setup.php'),work],check=True,capture_output=True)
 config_path=pathlib.Path(work)/'config.json';cfg=json.loads(config_path.read_text())
 with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
 base=f'http://127.0.0.1:{port}';cfg['public_base_url']=base;config_path.write_text(json.dumps(cfg))
 server=subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t',str(root/'public_html'),str(root/'server/router.php')],env={**os.environ,'DYWS_CONFIG':str(config_path)},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 jar=http.cookiejar.CookieJar();browser=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar));stranger=urllib.request.build_opener()
 checks=0;last_headers=None
 def request(route,body=None,status=200,client=browser,guest=True,extra=None):
  global checks,last_headers
  headers={'X-DYWS-Guest':'1'} if guest else {}
  if body is not None:headers['Content-Type']='application/json'
  headers.update(extra or {})
  req=urllib.request.Request(base+'/api/?route='+urllib.parse.quote(route,safe='/'),data=None if body is None else json.dumps(body).encode(),headers=headers)
  try:
   with client.open(req,timeout=5) as response:code=response.status;data=json.load(response);last_headers=response.headers
  except urllib.error.HTTPError as error:code=error.code;data=json.load(error);last_headers=error.headers
  assert code==status,(route,code,data);checks+=1;return data
 def sql(query,args=()):
  with sqlite3.connect(cfg['database']) as db:
   db.execute('PRAGMA foreign_keys=ON');return db.execute(query,args).fetchall()
 def order(**changes):
  return {'idempotencyKey':str(uuid.uuid4()),'customer':{'name':'Example Guest','phone':'7805550142','email':'guest@example.test'},'lines':[{'id':'breakfast0','variant':'','quantity':1}],'demoAcknowledged':True,'fulfillment':'delivery','addressDetails':{'line1':'123 Fictional Road','line2':'Unit 4','city':'Edmonton','region':'AB','postalCode':'T5A 0A1','country':'Canada'},**changes}
 def cookie():return next(c for c in jar if c.name.startswith('dyws_guest_'))
 try:
  for _ in range(50):
   try:request('/health');break
   except (OSError,urllib.error.URLError):time.sleep(.05)
  else:raise AssertionError('Server did not start')
  assert request('/guest-details')=={'profileId':None,'addresses':[]}
  assert not list(jar)
  request('/guest-details',status=403,guest=False)
  request('/guest-details',{'action':'forget'},status=403,extra={'Origin':'https://other.example'})
  request('/guest-details',{'action':'forget'},status=403,extra={'Sec-Fetch-Site':'cross-site'})
  request('/orders',order(),status=201)
  assert not sql('SELECT * FROM guest_details')
  consent={'enabled':True,'label':'Home','default':True}
  body=order(rememberDetails=consent)
  request('/orders',body,status=403,guest=False)
  invalid={**body,'lines':[]};request('/orders',invalid,status=422)
  assert not sql('SELECT * FROM guest_details')
  receipt=request('/orders',body,status=201,extra={'Origin':base})
  token=cookie().value;assert len(token)==64 and cookie().has_nonstandard_attr('HttpOnly')
  assert cookie().get_nonstandard_attr('SameSite')=='Lax' and cookie().path=='/'
  assert abs(cookie().expires-(int(time.time())+180*86400))<=2
  assert sql('SELECT token_hash FROM guest_details')[0][0]==hashlib.sha256(token.encode()).hexdigest()
  state=request('/guest-details');pid=state['profileId'];home=state['addresses'][0]['id']
  assert state['customer']=={**body['customer'],'phone':'(780) 555-0142'} and state['addresses'][0]['addressDetails']==body['addressDetails']
  assert state['defaultAddressId']==home
  assert 'token' not in json.dumps(state) and last_headers['Cache-Control']=='no-store'
  assert request('/guest-details',client=stranger)['addresses']==[]
  request('/tracking/'+receipt['id'],status=404)
  request('/manager/orders',status=401)
  # A visit and a replayed order cannot extend the sliding window.
  short_expiry=int(time.time())+300
  sql('UPDATE guest_details SET expires_at=?',(short_expiry,))
  assert request('/guest-details')['expiresAt']==short_expiry
  request('/orders',body,status=201)
  assert request('/guest-details')['expiresAt']==short_expiry
  assert last_headers.get('Set-Cookie') is None
  request('/orders',order(lines=[]),status=422)
  assert request('/guest-details')['expiresAt']==short_expiry
  # A new pickup order renews both database and cookie without changing addresses.
  request('/orders',order(fulfillment='pickup',customer={'name':'Another Example','phone':'7805550143'},rememberDetails={'enabled':False,'label':''}),status=201)
  state=request('/guest-details');assert state['expiresAt']>short_expiry and state['expiresAt']==cookie().expires
  assert state['addresses'][0]['id']==home and state['customer']=={**body['customer'],'phone':'(780) 555-0142'}
  # Repeated address selections deduplicate; a custom label is rendered as plain text.
  request('/orders',order(rememberDetails={**consent,'profileId':pid,'label':'<b>Example</b>'}),status=201)
  assert len(request('/guest-details')['addresses'])==1
  work_address={**body['addressDetails'],'line1':'456 Example Avenue','line2':''}
  request('/orders',order(addressDetails=work_address,rememberDetails={'enabled':True,'profileId':pid,'label':'Work'}),status=201)
  state=request('/guest-details');work_id=next(a['id'] for a in state['addresses'] if a['label']=='Work')
  expiry=state['expiresAt']
  state=request('/guest-details',{'action':'default','addressId':work_id});assert state['defaultAddressId']==work_id and state['expiresAt']==expiry
  request('/guest-details',{'action':'remove','addressId':work_id},client=stranger)
  assert len(request('/guest-details')['addresses'])==2
  state=request('/guest-details',{'action':'remove','addressId':work_id});assert len(state['addresses'])==1 and state['defaultAddressId'] is None
  request('/guest-details',{'action':'default','addressId':work_id},status=404)
  # A stale checkout cannot restore a removed address.
  request('/orders',order(addressDetails=work_address,rememberDetails={'enabled':True,'profileId':pid,'addressId':work_id,'label':'Work'}),status=201)
  assert len(request('/guest-details')['addresses'])==1
  # Explicit edits replace the selected address, with no duplicate address row.
  changed={**body['addressDetails'],'line2':'Unit 5'}
  request('/orders',order(addressDetails=changed,rememberDetails={**consent,'profileId':pid,'addressId':home}),status=201)
  assert request('/guest-details')['addresses'][0]['addressDetails']['line2']=='Unit 5'
  # Tenant changes cannot reuse the access token, even with the expected cookie name.
  cfg['tenant']='different-business';config_path.write_text(json.dumps(cfg))
  other_name='dyws_guest_'+hashlib.sha256((cfg['tenant']+'|/').encode()).hexdigest()[:16]
  assert request('/guest-details',extra={'Cookie':other_name+'='+token})['profileId'] is None
  cfg['tenant']='dyws-diner';config_path.write_text(json.dumps(cfg))
  assert request('/guest-details')['profileId']==pid
  count_orders=sql('SELECT count(*) FROM orders')[0][0]
  request('/guest-details',{'action':'forget'})
  assert not list(jar) and not sql('SELECT * FROM guest_details') and not sql('SELECT * FROM guest_addresses')
  assert sql('SELECT count(*) FROM orders')[0][0]==count_orders
  # Neither an old order replay nor a stale open form recreates forgotten details.
  request('/orders',body,status=201)
  request('/orders',order(rememberDetails={**consent,'profileId':pid}),status=201)
  assert not sql('SELECT * FROM guest_details')
  fresh=order(rememberDetails=consent);request('/orders',fresh,status=201)
  expired_pid=request('/guest-details')['profileId']
  sql('UPDATE guest_details SET expires_at=?',(int(time.time())-1,))
  assert request('/guest-details')['profileId'] is None and not sql('SELECT * FROM guest_addresses')
  request('/orders',order(rememberDetails={**consent,'profileId':expired_pid}),status=201)
  assert not sql('SELECT * FROM guest_details')
  # HTTPS cookie flags and subdirectory scope use the installation configuration.
  cfg['public_base_url']='https://restaurant.example/order';config_path.write_text(json.dumps(cfg))
  request('/orders',order(rememberDetails=consent),status=201)
  assert 'secure' in last_headers['Set-Cookie'].lower() and 'path=/order/' in last_headers['Set-Cookie'].lower()
  with browser.open(base+'/terms/') as response:
   html=response.read().decode();assert '180 days' in html and 'Each new order starts a fresh 180 day period.' in html and 'Forget my details' in html
  with browser.open(base+'/home.php') as response:assert 'href="terms/"' in response.read().decode()
  # Scheduled cleanup removes only expired profiles, leaving order records intact.
  sql('UPDATE guest_details SET expires_at=?',(int(time.time())-1,))
  count_orders=sql('SELECT count(*) FROM orders')[0][0]
  subprocess.run(['php',str(root/'server/cleanup-guest-details.php')],env={**os.environ,'DYWS_CONFIG':str(config_path)},check=True,capture_output=True)
  assert not sql('SELECT * FROM guest_details') and not sql('SELECT * FROM guest_addresses')
  assert sql('SELECT count(*) FROM orders')[0][0]==count_orders
  # The public demo saves only the server enforced fictional contacts.
  demo=pathlib.Path(work)/'locked-demo'
  subprocess.run(['php',str(root/'plugins/demo-lockdown/setup.php'),str(demo),base],check=True,capture_output=True)
  config_path.write_text((demo/'config.json').read_text())
  request('/orders',order(rememberDetails=consent),status=201)
  demo_state=request('/guest-details')
  assert demo_state['customer']['name']=='Demo Customer'
  assert demo_state['addresses'][0]['addressDetails']['line1']=='123 Example Avenue NW'
  request('/guest-details',{'action':'forget'})
  assert request('/guest-details')['profileId'] is None
  print(f'Remembered guest HTTP API: {checks} checks passed.')
 finally:server.terminate();server.wait(timeout=5)
