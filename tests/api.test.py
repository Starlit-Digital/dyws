"""Exercise the actual HTTP entry point against an isolated temporary database."""
import contextlib,json,os,pathlib,socket,subprocess,tempfile,time,urllib.request,urllib.error,uuid
root=pathlib.Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='dyws-api-') as work:
 subprocess.run(['php',str(root/'server/setup.php'),work],check=True,capture_output=True)
 access=(pathlib.Path(work)/'LOCAL-ACCESS.txt').read_text().splitlines()
 manager=next(x.split(': ',1)[1] for x in access if x.startswith('Manager password:'))
 driver=next(x.split(': ',1)[1] for x in access if x.startswith('Driver password:'))
 with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
 env={**os.environ,'DYWS_CONFIG':work+'/config.json'}
 server=subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t',str(root/'public_html'),str(root/'server/router.php')],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 checks=0
 def request(route,body=None,token=None,tracking=None,status=200):
  global checks
  headers={}
  if body is not None:headers['Content-Type']='application/json'
  if token:headers['Authorization']='Bearer '+token
  if tracking:headers['X-Tracking-Token']=tracking
  req=urllib.request.Request(f'http://127.0.0.1:{port}/api/?route='+urllib.parse.quote(route,safe='/'),data=None if body is None else json.dumps(body).encode(),headers=headers)
  try:
   with urllib.request.urlopen(req,timeout=4)as r:code=r.status;data=json.load(r)
  except urllib.error.HTTPError as e:code=e.code;data=json.load(e)
  assert code==status,(route,code,data);checks+=1;return data
 try:
  for i in range(40):
   try:request('/health');break
   except (OSError,urllib.error.URLError):time.sleep(.05)
  else:raise AssertionError('Server failed to start')
  with urllib.request.urlopen(f'http://127.0.0.1:{port}/home.php',timeout=4) as page:
   html=page.read().decode()
   assert html.count('class="dyws-category"')==5 and html.count('class="dyws-product"')==35
   assert 'Sunrise Breakfast' in html and 'data-dyws-rendered' in html and '<?php' not in html
   checks+=1
  for page in ['orders','reports','catalog','drivers','password','settings','plugins','driver','tracking']:
   with urllib.request.urlopen(f'http://127.0.0.1:{port}/{page}/',timeout=4) as response:
    html=response.read().decode();assert response.status==200 and '<html' in html and '<?php' not in html
    assert '.html' not in html and 'index.php' not in html
    checks+=1
  assert not list((root/'public_html').rglob('*.html'))
  with urllib.request.urlopen(f'http://127.0.0.1:{port}/orders',timeout=4) as response:
   assert response.url.endswith('/auth/');checks+=1
  request('/manager/orders',status=401)
  request('/login',{'role':'manager','password':'wrong'},status=401)
  manager_token=request('/login',{'role':'manager','password':manager})['token']
  driver_token=request('/login',{'role':'driver','driverId':'demo-driver','password':driver})['token']
  request('/manager/orders',token=driver_token,status=403)
  for path in ['/manager/drivers','/manager/password']:
   request(path,{},status=401)
   request(path,{},token=driver_token,status=403)
  for path in ['/manager/maps','/manager/driver-locations']:
   request(path,status=401)
   request(path,token=driver_token,status=403)
  assert request('/maps/config')['enabled'] is False
  request('/manager/maps',{},status=401)
  request('/manager/maps',{},token=driver_token,status=403)
  assert request('/manager/driver-locations',token=manager_token)['locations']==[]
  # Plugin administration is manager only. Deactivation keeps core orders and settings.
  request('/manager/plugins',status=401)
  request('/manager/plugins',token=driver_token,status=403)
  request('/manager/plugins',{},token=driver_token,status=403)
  plugins=request('/manager/plugins',token=manager_token)
  assert next(p for p in plugins['plugins'] if p['id']=='google-maps')['active']
  assert request('/plugins')['plugins'][0]['browserModule']=='index.js'
  request('/manager/plugins/google-maps/settings',status=401)
  request('/manager/plugins/google-maps/settings',token=driver_token,status=403)
  maps=request('/manager/plugins/google-maps/settings',token=manager_token)
  maps_saved=request('/manager/plugins/google-maps/settings',{**maps,'browserKey':'a'*39,'enabled':True},token=manager_token)
  disabled=request('/manager/plugins',{'id':'google-maps','active':False,'revision':plugins['revision']},token=manager_token)
  assert sorted(p['id'] for p in request('/plugins')['plugins'])==['datatables','order-reporting','stripe']
  request('/maps/config',status=404)
  request('/plugins/google-maps/config',status=404)
  request('/manager/maps',token=manager_token,status=404)
  assert request('/catalog')['categories']
  request('/manager/plugins',{'id':'google-maps','active':True,'revision':plugins['revision']},token=manager_token,status=409)
  request('/manager/plugins',{'id':'google-maps','active':True,'revision':disabled['revision']},token=manager_token)
  assert request('/maps/config')['browserKey']=='a'*39
  restored=request('/manager/plugins/google-maps/settings',token=manager_token)
  assert restored['hasKey'] and restored['revision']==maps_saved['revision']
  initial_settings=request('/settings')
  assert initial_settings=={'driverRole':{'singular':'Driver','plural':'Drivers'},'timeZone':'America/Edmonton'}
  request('/manager/settings',status=401)
  request('/manager/settings',token=driver_token,status=403)
  request('/manager/settings',{},status=401)
  request('/manager/settings',{},token=driver_token,status=403)
  settings=request('/manager/settings',token=manager_token)
  settings['settings']['driverRole']={'singular':'Admin','plural':'Admins'}
  renamed=request('/manager/settings',settings,token=manager_token)
  assert request('/settings')==renamed['settings']
  request('/manager/settings',settings,token=manager_token,status=409)
  # A display name of Admin never changes session authority or existing accounts.
  request('/manager/orders',token=driver_token,status=403)
  assert request('/driver/orders',token=driver_token)['orders']==[]
  drivers=request('/manager/drivers',token=manager_token)
  assert drivers['drivers'][0]['id']=='demo-driver' and 'password_hash' not in str(drivers)
  request('/manager/password',{'currentPassword':'wrong','newPassword':'fictional-new-password','confirmPassword':'fictional-new-password'},token=manager_token,status=422)
  order={'idempotencyKey':str(uuid.uuid4()),'customer':{'name':'Test Guest','phone':'7805550142'},'lines':[{'id':'breakfast0','variant':'','quantity':1,'price':1}],'demoAcknowledged':True}
  receipt=request('/orders',order,status=201);assert receipt['total']==1570
  assert request('/orders',order,status=201)['id']==receipt['id']
  request('/tracking/'+receipt['id'],status=404)
  tracking=request('/tracking/'+receipt['id'],tracking=receipt['trackingToken']);assert tracking['status']=='placed' and 'customer_name' not in tracking
  orders=request('/manager/orders',token=manager_token);assert len(orders['orders'])==1
  assert request('/driver/orders',token=driver_token)['orders']==[]
  catalog=request('/catalog');assert catalog['businessName']=='Starlit Diner'
  request('/manager/catalog',status=401)
  request('/manager/catalog',token=driver_token,status=403)
  saved=request('/manager/catalog',token=manager_token)
  saved['catalog']['categories'][0]['items'][0]['price']=1595
  updated=request('/manager/catalog',saved,token=manager_token)
  request('/manager/catalog',saved,token=manager_token,status=409)
  assert request('/catalog')['categories'][0]['items'][0]['price']==1595
  request('/manager/stripe',status=401)
  request('/manager/stripe',{'enabled':False},token=driver_token,status=403)
  stripe=request('/manager/stripe',token=manager_token);assert not stripe['enabled'] and 'apiKey' not in stripe
  request('/manager/stripe',{'enabled':True,'apiKey':'rk_live_invalid'},token=manager_token,status=422)
  request('/orders/'+receipt['id']+'/checkout',{},tracking=receipt['trackingToken'],status=409)
  # Complete device GPS flow against the real HTTP entry point, using fictional coordinates.
  gps_order={**order,'idempotencyKey':str(uuid.uuid4()),'fulfillment':'delivery','address':'15320 Fictional Lane NW'}
  delivery=request('/orders',gps_order,status=201)
  route='/driver/orders/'+delivery['id']+'/location'
  request(route+'/start',{},status=401)
  request(route+'/start',{},token=manager_token,status=403)
  request(route+'/start',{},token=driver_token,status=403)
  request('/manager/orders/'+delivery['id']+'/assign',{'driverId':'demo-driver'},token=manager_token)
  for state in ['accepted','preparing','ready']:
   request('/manager/orders/'+delivery['id']+'/status',{'status':state},token=manager_token)
  request(route+'/start',{},token=driver_token,status=403)
  request('/driver/orders/'+delivery['id']+'/status',{'status':'out_for_delivery'},token=driver_token)
  sharing=request(route+'/start',{'source':'simulated'},token=driver_token)
  fix={'latitude':53.61665,'longitude':-113.39804,'accuracy':8,'recordedAt':int(time.time()),'sharingToken':sharing['sharingToken']}
  request(route,fix,token=driver_token)
  request(route,fix,token=driver_token,status=409)
  request(route,{**fix,'accuracy':'NaN'},token=driver_token,status=422)
  tracked=request('/tracking/'+delivery['id'],tracking=delivery['trackingToken'])
  assert tracked['location']['latitude']==fix['latitude'] and tracked['locationSource']=='simulated' and not tracked['gpsStale']
  managed=request('/manager/orders',token=manager_token)
  gps=next(o for o in managed['orders'] if o['id']==delivery['id'])['gps']
  assert gps['location']['latitude']==tracked['location']['latitude'] and 'sharingToken' not in str(managed)
  request(route+'/heartbeat',{'sharingToken':'a'*64},token=driver_token,status=403)
  request(route+'/heartbeat',{'sharingToken':sharing['sharingToken']},token=driver_token)
  assert request('/tracking/'+delivery['id'],tracking=delivery['trackingToken'])['location']['recorded_at']==fix['recordedAt']
  request(route+'/stop',{'sharingToken':sharing['sharingToken']},token=driver_token)
  assert request('/tracking/'+delivery['id'],tracking=delivery['trackingToken'])['location'] is None
  request(route,{**fix,'recordedAt':int(time.time())+1},token=driver_token,status=403)
  # An old stop request cannot revoke a newer sharing session.
  newer=request(route+'/start',{'source':'device'},token=driver_token)
  request(route+'/stop',{'sharingToken':sharing['sharingToken']},token=driver_token)
  request(route,{**fix,'sharingToken':newer['sharingToken']},token=driver_token)
  config_path=pathlib.Path(work)/'config.json';cfg=json.loads(config_path.read_text());cfg['driver_test_location']={'latitude':53.61665,'longitude':-113.39804,'accuracy':8};config_path.write_text(json.dumps(cfg))
  mock=request('/driver/orders',token=driver_token)['orders'][0]['gps'];assert mock['source']=='simulated' and mock['location']['latitude']==53.61665
  assert request('/manager/driver-locations',token=manager_token)['locations'][0]['gps']['source']=='simulated'
  # Completion is driver authorised, reaches the customer, and removes GPS and active work.
  request('/driver/orders/'+delivery['id']+'/status',{'status':'delivered'},token=driver_token,status=409)
  request('/manager/orders/'+delivery['id']+'/payment',{'kind':'capture'},token=manager_token)
  request('/driver/orders/'+delivery['id']+'/status',{'status':'delivered'},token=driver_token)
  finished=request('/tracking/'+delivery['id'],tracking=delivery['trackingToken'])
  assert finished['status']=='delivered' and finished['location'] is None and finished['locationSource'] is None
  assert finished['events'][-1]['status']=='delivered'
  assert not any(o['id']==delivery['id'] for o in request('/driver/orders',token=driver_token)['orders'])
  request(route+'/start',{},token=driver_token,status=403)
  request('/driver/orders/'+delivery['id']+'/status',{'status':'out_for_delivery'},token=driver_token,status=409)
  request('/logout',{},token=driver_token)
  assert request('/tracking/'+delivery['id'],tracking=delivery['trackingToken'])['location'] is None
  request(route,fix,token=driver_token,status=401)
  full={**gps_order,'idempotencyKey':str(uuid.uuid4()),'addressDetails':{'line1':'123 Fictional Road','line2':'Unit 4','city':'Edmonton','region':'AB','postalCode':'T5A 0A1','country':'Canada'}}
  complete=request('/orders',full,status=201)
  detail=next(o for o in request('/manager/orders',token=manager_token)['orders'] if o['id']==complete['id']);assert detail['addressDetails']==full['addressDetails'] and 'T5A 0A1' in detail['address']
  assert request('/orders',full,status=201)['id']==complete['id']
  full['addressDetails']['postalCode']='';request('/orders',full,status=422)
  request('/logout',{},token=manager_token)
  request('/manager/orders',token=manager_token,status=401)
  print(f'HTTP API: {checks} checks passed.')
 finally:server.terminate();server.wait(timeout=5)
