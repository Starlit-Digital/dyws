"""Exercise the actual HTTP entry point against an isolated temporary database."""
import contextlib,json,os,pathlib,socket,subprocess,tempfile,time,urllib.request,urllib.error,uuid
root=pathlib.Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='starlit-api-') as work:
 subprocess.run(['php',str(root/'server/setup.php'),work],check=True,capture_output=True)
 access=(pathlib.Path(work)/'LOCAL-ACCESS.txt').read_text().splitlines()
 manager=next(x.split(': ',1)[1] for x in access if x.startswith('Manager password:'))
 driver=next(x.split(': ',1)[1] for x in access if x.startswith('Driver password:'))
 with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
 env={**os.environ,'STARLIT_GO_CONFIG':work+'/config.json'}
 server=subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t',str(root/'public_html')],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 checks=0
 def request(route,body=None,token=None,tracking=None,status=200):
  global checks
  headers={}
  if body is not None:headers['Content-Type']='application/json'
  if token:headers['Authorization']='Bearer '+token
  if tracking:headers['X-Tracking-Token']=tracking
  req=urllib.request.Request(f'http://127.0.0.1:{port}/api/index.php?route='+urllib.parse.quote(route,safe='/'),data=None if body is None else json.dumps(body).encode(),headers=headers)
  try:
   with urllib.request.urlopen(req,timeout=4)as r:code=r.status;data=json.load(r)
  except urllib.error.HTTPError as e:code=e.code;data=json.load(e)
  assert code==status,(route,code,data);checks+=1;return data
 try:
  for i in range(40):
   try:request('/health');break
   except (OSError,urllib.error.URLError):time.sleep(.05)
  else:raise AssertionError('Server failed to start')
  with urllib.request.urlopen(f'http://127.0.0.1:{port}/index.php',timeout=4) as page:
   html=page.read().decode()
   assert html.count('class="dyws-category"')==5 and html.count('class="dyws-product"')==35
   assert 'Sunrise Breakfast' in html and 'data-dyws-rendered' in html and '<?php' not in html
   checks+=1
  request('/manager/orders',status=401)
  request('/login',{'role':'manager','password':'wrong'},status=401)
  manager_token=request('/login',{'role':'manager','password':manager})['token']
  driver_token=request('/login',{'role':'driver','driverId':'demo-driver','password':driver})['token']
  request('/manager/orders',token=driver_token,status=403)
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
  request('/logout',{},token=manager_token)
  request('/manager/orders',token=manager_token,status=401)
  print(f'HTTP API: {checks} checks passed.')
 finally:server.terminate();server.wait(timeout=5)
