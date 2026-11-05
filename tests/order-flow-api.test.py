"""Archive role isolation and Free report restrictions at authenticated HTTP boundaries."""
import json,os,pathlib,socket,subprocess,tempfile,time,urllib.request,urllib.error,urllib.parse,uuid
root=pathlib.Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='dyws-flow-api-') as temp:
 work=pathlib.Path(temp);subprocess.run(['php',str(root/'server/setup.php'),str(work)],check=True,capture_output=True)
 config=json.loads((work/'config.json').read_text());config['plugins_path']=str(root/'plugins');config['pricing_tier']='pro'
 def save(): (work/'config.json').write_text(json.dumps(config))
 save();access=(work/'LOCAL-ACCESS.txt').read_text().splitlines()
 def password(key):return next(s.split(': ',1)[1] for s in access if s.startswith(key+':'))
 with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
 proc=subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t',str(root/'public_html'),str(root/'server/router.php')],env={**os.environ,'DYWS_CONFIG':str(work/'config.json')},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 checks=0
 def api(route,body=None,token=None,expected=200,query='',tracking=None):
  global checks
  headers={'Content-Type':'application/json'}
  if token:headers['Authorization']='Bearer '+token
  if tracking:headers['X-Tracking-Token']=tracking
  request=urllib.request.Request(f'http://127.0.0.1:{port}/api/?route='+urllib.parse.quote(route,safe='/')+query,data=json.dumps(body).encode() if body is not None else None,headers=headers)
  try:
   with urllib.request.urlopen(request,timeout=5) as r:code=r.status;data=json.load(r)
  except urllib.error.HTTPError as e:code=e.code;data=json.load(e)
  assert code==expected,(route,code,data);checks+=1;return data
 try:
  for _ in range(50):
   try:api('/health');break
   except OSError:time.sleep(.1)
  manager=api('/login',{'role':'manager','password':password('Manager password')})['token'];driver=api('/login',{'role':'driver','driverId':'demo-driver','password':password('Driver password')})['token']
  order=api('/orders',{'idempotencyKey':str(uuid.uuid4()),'customer':{'name':'Fictional Archive Guest','phone':'7805550142'},'fulfillment':'delivery','address':'100 Fictional Street','lines':[{'id':'breakfast0','variant':'','quantity':1}],'demoAcknowledged':True},expected=201)
  base='/manager/orders/'+order['id'];dbase='/driver/orders/'+order['id']
  api(base+'/archive',{'archived':True},expected=401);api(base+'/archive',{'archived':True},driver,403);api(dbase+'/archive',{'archived':True},manager,403)
  api(base+'/archive',{'archived':True},manager,409)
  api(base+'/assign',{'driverId':'demo-driver'},manager)
  for status in ['accepted','preparing','ready']:api(base+'/status',{'status':status},manager)
  api(dbase+'/status',{'status':'out_for_delivery'},driver);api(dbase+'/status',{'status':'delivered'},driver,409)
  api(base+'/payment',{'kind':'capture'},manager);api(dbase+'/status',{'status':'delivered'},driver)
  history=api('/driver/orders',token=driver)['history'];assert history[0]['id']==order['id'] and 'customer_phone' not in history[0]
  api(dbase+'/archive',{'archived':True},driver);data=api('/driver/orders',token=driver);assert not data['history'] and data['archived'][0]['id']==order['id']
  assert api('/manager/orders',token=manager)['orders'][0]['id']==order['id']
  api(base+'/archive',{'archived':True},manager);assert not api('/manager/orders',token=manager)['orders'];assert api('/manager/orders',token=manager,query='&archived=1')['orders'][0]['id']==order['id']
  assert api('/tracking/'+order['id'],tracking=order['trackingToken'])['status']=='delivered'
  api(base+'/archive',{'archived':False},manager);api(dbase+'/archive',{'archived':False},driver)
  api('/manager/entitlements',expected=401);api('/manager/entitlements',token=driver,expected=403);assert api('/manager/entitlements',token=manager)['tier']=='pro';api('/manager/reports',token=manager)
  key=api('/manager/api-keys',{'name':'Fictional reporting test','scopes':['reports:read','reports:export']},manager)['secret']
  config['pricing_tier']='free';save();assert api('/manager/entitlements',token=manager)['capabilities']['reports'] is False;assert api('/driver/profile',token=driver)['tips'] is None
  assert api('/manager/reports',token=manager,expected=403)['code']=='pro_required'
  for route,body in [('/manager/plugins/order-reporting/dashboard',None),('/manager/plugins/order-reporting/export-options',None),('/manager/plugins/order-reporting/export',{}),('/manager/plugins/order-reporting/email',{})]:api(route,body,manager,403)
  assert api('/integrations/v1/commands',token=key)['commands']==[]
  for name in ['reports.summary','reports.export']:api('/integrations/v1/commands/'+name+'/execute',{},key,403)
  # Server rendered bootstrap must not contain a report payload or computed totals on Free.
  request=urllib.request.Request(f'http://127.0.0.1:{port}/reports/',headers={'Cookie':'dyws_admin_session='+manager})
  with urllib.request.urlopen(request,timeout=5) as response:html=response.read().decode()
  assert '&quot;tier&quot;:&quot;free&quot;' in html and '&quot;/manager/reports&quot;' not in html and '&quot;captured&quot;' not in html
  config['pricing_tier']='pro';save();api('/manager/reports',token=manager)
  print(f'Order flow API: {checks} HTTP checks passed. Free bootstrap contains no report data.')
 finally:proc.terminate();proc.wait(timeout=5)
