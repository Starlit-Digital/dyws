"""HTTP dispatch authorization, concurrency, shared GPS and private tracking."""
import concurrent.futures,json,os,pathlib,socket,subprocess,tempfile,time,urllib.request,urllib.error,urllib.parse,uuid
root=pathlib.Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='dyws-runs-api-') as work:
 subprocess.run(['php',str(root/'server/setup.php'),work],check=True,capture_output=True)
 access=(pathlib.Path(work)/'LOCAL-ACCESS.txt').read_text().splitlines()
 manager=next(x.split(': ',1)[1] for x in access if x.startswith('Manager password:'))
 driver=next(x.split(': ',1)[1] for x in access if x.startswith('Driver password:'))
 with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
 server=subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t',str(root/'public_html'),str(root/'server/router.php')],env={**os.environ,'DYWS_CONFIG':work+'/config.json'},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 checks=0
 def request(route,body=None,token=None,tracking=None,status=200):
  global checks
  headers={}
  if body is not None:headers['Content-Type']='application/json'
  if token:headers['Authorization']='Bearer '+token
  if tracking:headers['X-Tracking-Token']=tracking
  req=urllib.request.Request(f'http://127.0.0.1:{port}/api/?route='+urllib.parse.quote(route,safe='/'),data=None if body is None else json.dumps(body).encode(),headers=headers)
  try:
   with urllib.request.urlopen(req,timeout=8)as r:code=r.status;data=json.load(r)
  except urllib.error.HTTPError as e:code=e.code;data=json.load(e)
  assert code==status,(route,code,data);checks+=1;return data
 try:
  for i in range(40):
   try:request('/health');break
   except (OSError,urllib.error.URLError):time.sleep(.05)
  mt=request('/login',{'role':'manager','password':manager})['token']
  dt=request('/login',{'role':'driver','driverId':'demo-driver','password':driver})['token']
  request('/manager/runs',{},status=401);request('/manager/runs',{},token=dt,status=403)
  orders=[]
  for i in range(3):
   r=request('/orders',{'demoAcknowledged':True,'idempotencyKey':str(uuid.uuid4()),'customer':{'name':f'Run Guest {i}','phone':'7805550142'},'lines':[{'id':'breakfast0','quantity':1}],'fulfillment':'delivery','address':f'{i+1} Fictional Lane'},status=201);orders.append(r)
   for state in ['accepted','preparing','ready']:request('/manager/orders/'+r['id']+'/status',{'status':state},token=mt)
   request('/manager/orders/'+r['id']+'/payment',{'kind':'capture'},token=mt)
  body={'driverId':'demo-driver','orderIds':[o['id'] for o in orders[:2]],'idempotencyKey':str(uuid.uuid4())}
  with concurrent.futures.ThreadPoolExecutor(2) as pool:results=list(pool.map(lambda _:request('/manager/runs',body,token=mt),range(2)))
  assert results[0]['id']==results[1]['id'];checks+=1
  run=results[0];rid=run['id'];base='/driver/runs/'+rid
  assert len(request('/manager/orders',token=mt)['runs'])==1
  assert request('/driver/orders',token=dt)['runs'][0]['orderIds']==body['orderIds']
  request(base+'/start',{},token=mt,status=403);request(base+'/start',{},status=401)
  request(base+'/location/start',{'source':'device'},token=dt,status=403)
  request(base+'/start',{},token=dt)
  request('/manager/runs/'+rid,{'action':'cancel','revision':1},token=mt,status=409)
  first,second=orders[:2]
  request('/driver/orders/'+first['id']+'/location/start',{'source':'device'},token=dt,status=409)
  share=request(base+'/location/start',{'source':'device'},token=dt)['sharingToken']
  point={'sharingToken':share,'latitude':53.61665,'longitude':-113.39804,'accuracy':8,'recordedAt':int(time.time())}
  request(base+'/location',point,token=dt)
  request(base+'/location/heartbeat',{'sharingToken':share},token=dt)
  for i,o in enumerate(orders[:2]):
   t=request('/tracking/'+o['id'],tracking=o['trackingToken']);assert t['location']['latitude']==point['latitude'] and t['deliveryRun']['stopsAhead']==i
  request('/tracking/'+second['id'],tracking=first['trackingToken'],status=404)
  assert request('/tracking/'+orders[2]['id'],tracking=orders[2]['trackingToken'])['location'] is None
  request('/driver/orders/'+second['id']+'/status',{'status':'delivered'},token=dt,status=409)
  request('/driver/orders/'+first['id']+'/status',{'status':'delivered'},token=dt)
  point['recordedAt']+=1;request(base+'/location',point,token=dt)
  assert request('/tracking/'+first['id'],tracking=first['trackingToken'])['location'] is None
  t=request('/tracking/'+second['id'],tracking=second['trackingToken']);assert t['deliveryRun']=={'stopsAhead':0,'isNext':True}
  request('/logout',{},token=dt)
  assert request('/tracking/'+second['id'],tracking=second['trackingToken'])['location'] is None
  request(base+'/location',point,token=dt,status=401)
  dt=request('/login',{'role':'driver','driverId':'demo-driver','password':driver})['token']
  request(base+'/location/heartbeat',{'sharingToken':share},token=dt,status=403)
  point['sharingToken']=request(base+'/location/start',{'source':'device'},token=dt)['sharingToken'];request(base+'/location',point,token=dt)
  request('/driver/orders/'+second['id']+'/status',{'status':'delivered'},token=dt)
  assert request('/driver/orders',token=dt)['runs']==[]
  t=request('/tracking/'+second['id'],tracking=second['trackingToken']);assert t['status']=='delivered' and t['location'] is None
  print(f'Delivery run HTTP: {checks} requests and checks passed.')
 finally:server.terminate();server.wait(timeout=5)
