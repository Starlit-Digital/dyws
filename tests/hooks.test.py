"""Run every server hook at its real HTTP call site with an isolated sample plugin."""
import json,os,pathlib,shutil,socket,sqlite3,subprocess,tempfile,time,urllib.request,urllib.error,uuid
root=pathlib.Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='dyws-hooks-') as temporary:
 work=pathlib.Path(temporary)
 subprocess.run(['php',str(root/'server/setup.php'),str(work)],check=True,capture_output=True)
 config=json.loads((work/'config.json').read_text());config['plugins_path']=str(work/'plugins');(work/'config.json').write_text(json.dumps(config))
 shutil.copytree(root/'plugins',work/'plugins')
 fixture=work/'plugins/fixture';fixture.mkdir()
 manifest={'id':'fixture','name':'Fixture','description':'Test hooks','version':'1.0','apiVersion':1,'entry':'plugin.php','capabilities':['validation']}
 (fixture/'plugin.json').write_text(json.dumps(manifest))
 (fixture/'plugin.php').write_text('''<?php
use dyws\\ApiError;
return function($plugin){
 $log=function($name)use($plugin){file_put_contents(dirname($plugin->config['database']).'/hooks.log',$name."\\n",FILE_APPEND);};
 foreach(['plugin.activated','plugin.deactivated','catalog.saved','order.created','order.status_changed','order.assigned','api.respond','reports.generated'] as $name)$plugin->addAction($name,fn()=>$log($name));
 foreach(['catalog.public','tracking.public','reports.summary','api.response','reports.dataset','page.presentation'] as $name)$plugin->addFilter($name,function($value)use($name,$log){$log($name);$value['fixtureHook']=$name;return $value;});
 $plugin->addFilter('order.input',function($value)use($log){$log('order.input');return $value;});
 $plugin->addFilter('lookup.results',function($value,$context)use($log){$log('lookup.results');if($context['kind']==='fixture')$value['results'][]=['kind'=>'fixture','id'=>'fixture-record','label'=>$context['query']];return $value;});
 $plugin->addValidator('catalog.validating',function($catalog)use($log){$log('catalog.validating');if($catalog['businessName']==='Denied catalog')throw new ApiError('Fixture rejects this catalog.');});
 $plugin->addValidator('order.validating',function($order,$totals)use($log){$log('order.validating');if($order['notes']==='reject')throw new ApiError('Fixture rejects this order.');if($order['notes']==='crash')throw new RuntimeException('Fixture failure');if($totals['total']<1)throw new ApiError('Total is required.');});
 $plugin->addValidator('order.status_changing',function($order,$status)use($log){$log('order.status_changing');if($status==='cancelled')throw new ApiError('Fixture rejects cancellation.');});
};''')
 observer=work/'plugins/observer';observer.mkdir();(observer/'plugin.json').write_text(json.dumps({**manifest,'id':'observer','capabilities':[]}));(observer/'plugin.php').write_text("<?php return function($p){};")
 access=(work/'LOCAL-ACCESS.txt').read_text().splitlines();manager=next(x.split(': ',1)[1] for x in access if x.startswith('Manager password:'));driver=next(x.split(': ',1)[1] for x in access if x.startswith('Driver password:'))
 with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
 server=subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t',str(root/'public_html'),str(root/'server/router.php')],env={**os.environ,'DYWS_CONFIG':str(work/'config.json')},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 checks=0
 def check(value):
  global checks
  assert value;checks+=1
 def request(route,body=None,token=None,tracking=None,status=200,query=''):
  global checks
  headers={}
  if body is not None:headers['Content-Type']='application/json'
  if token:headers['Authorization']='Bearer '+token
  if tracking:headers['X-Tracking-Token']=tracking
  req=urllib.request.Request(f'http://127.0.0.1:{port}/api/?route='+urllib.parse.quote(route,safe='/')+query,data=None if body is None else json.dumps(body).encode(),headers=headers)
  try:
   with urllib.request.urlopen(req,timeout=4)as r:code=r.status;data=json.load(r)
  except urllib.error.HTTPError as e:code=e.code;data=json.load(e)
  assert code==status,(route,code,data);checks+=1;return data
 def toggle(id,active):
  state=request('/manager/plugins',token=admin)
  return request('/manager/plugins',{'id':id,'active':active,'revision':state['revision']},token=admin)
 def log():return (work/'hooks.log').read_text().splitlines()
 try:
  for _ in range(40):
   try:request('/health');break
   except (OSError,urllib.error.URLError):time.sleep(.05)
  admin=request('/login',{'role':'manager','password':manager})['token'];driver_token=request('/login',{'role':'driver','driverId':'demo-driver','password':driver})['token']
  toggle('fixture',True);toggle('observer',True);toggle('observer',False)
  catalog=request('/catalog');check(catalog['fixtureHook']=='api.response')
  manager_catalog=request('/manager/catalog',token=admin);bad={**manager_catalog['catalog'],'businessName':'Denied catalog'}
  request('/manager/catalog',{'catalog':bad,'revision':manager_catalog['revision']},token=admin,status=422)
  check(request('/manager/catalog',token=admin)['revision']==manager_catalog['revision'])
  request('/manager/catalog',manager_catalog,token=admin)
  body={'demoAcknowledged':True,'idempotencyKey':str(uuid.uuid4()),'customer':{'name':'Fixture Customer','phone':'7805550100'},'fulfillment':'delivery','address':'100 Example Street','lines':[{'id':catalog['categories'][0]['items'][0]['id'],'variant':'','quantity':1}],'pluginData':{'fixture':{'note':'Handle with care'}}}
  request('/orders',{**body,'notes':'reject'},status=422);request('/orders',{**body,'notes':'crash'},status=503)
  check(request('/manager/orders',token=admin)['orders']==[])
  receipt=request('/orders',body,status=201);order=receipt['id'];tracking=receipt['trackingToken']
  check(request('/orders',body,status=201)['id']==order)
  before=len(log());request('/tracking/'+order,tracking='wrong',status=404);check(len(log())==before)
  track=request('/tracking/'+order,tracking=tracking);check('pluginData' not in track)
  stored=request('/manager/orders',token=admin)['orders'][0];check(stored['pluginData']==body['pluginData'])
  request('/manager/orders/'+order+'/status',{'status':'cancelled'},token=admin,status=422)
  request('/manager/orders/'+order+'/status',{'status':'accepted'},token=admin)
  before=log().count('order.status_changing');request('/driver/orders/'+order+'/status',{'status':'delivered'},token=driver_token,status=403);check(log().count('order.status_changing')==before)
  request('/manager/orders/'+order+'/assign',{'driverId':'demo-driver'},token=admin)
  request('/manager/reports',token=admin)
  before=len(log());request('/manager/lookup',query='&q=Fixture',status=401);request('/manager/lookup',query='&q=Fixture',token=driver_token,status=403);check(len(log())==before)
  result=request('/manager/lookup',query='&q=Fixture&kind=orders',token=admin);check(result['results'][0]['id']==order and 'customer_phone' not in result['results'][0])
  result=request('/manager/lookup',query='&q=Custom&kind=fixture',token=admin);check(result['results']==[{'kind':'fixture','id':'fixture-record','label':'Custom'}])
  check(request('/manager/lookup',query='&q=%25&kind=orders',token=admin)['results']==[])
  with urllib.request.urlopen(f'http://127.0.0.1:{port}/auth/') as response:check(response.status==200)
  # Mandatory installation access hooks are exercised by demo-lockdown.test.py.
  hooks=request('/plugins')['hooks'];check(len(hooks)==37 and len({h['name'] for h in hooks})==37)
  check({h['name'] for h in hooks if h['runtime']=='php' and h['name'] not in ['installation.validating','request.validating','auth.validating']}<=set(log()))
  # Removed required validation code fails closed, while managers can still inspect settings.
  shutil.rmtree(fixture)
  body['idempotencyKey']=str(uuid.uuid4());request('/orders',body,status=503)
  request('/manager/plugins',token=admin)
  print(f'Plugin hooks HTTP: {checks} checks passed.')
 finally:
  server.terminate();server.wait(timeout=5)
