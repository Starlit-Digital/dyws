"""Connector settings authorization, callback signatures and observation hooks over real HTTP."""
import base64,hashlib,hmac,http.cookiejar,re,json,os,pathlib,shutil,socket,subprocess,tempfile,time,urllib.request,urllib.error,urllib.parse
root=pathlib.Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='dyws-connectors-api-') as temp:
 work=pathlib.Path(temp);subprocess.run(['php',str(root/'server/setup.php'),str(work)],check=True,capture_output=True)
 config=json.loads((work/'config.json').read_text());config['plugins_path']=str(work/'plugins');shutil.copytree(root/'plugins',work/'plugins')
 with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
 base=f'http://127.0.0.1:{port}';config['public_base_url']=base;(work/'config.json').write_text(json.dumps(config))
 fixture=work/'plugins/event-observer';fixture.mkdir();(fixture/'plugin.json').write_text(json.dumps({'id':'event-observer','name':'Observer','description':'Fixture','version':'1.0','apiVersion':1,'entry':'plugin.php'}))
 (fixture/'plugin.php').write_text("<?php return function($p){$p->addAction('payments.connector_event',function($id,$event)use($p){file_put_contents(dirname($p->config['database']).'/events.log',$id.'\\n',FILE_APPEND);});};")
 access=(work/'LOCAL-ACCESS.txt').read_text().splitlines();password=lambda key:next(x.split(': ',1)[1] for x in access if x.startswith(key+':'))
 proc=subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t',str(root/'public_html'),str(root/'server/router.php')],env={**os.environ,'DYWS_CONFIG':str(work/'config.json')},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 checks=0
 def request(route,body=None,token=None,status=200,headers=None):
  global checks
  data=None if body is None else json.dumps(body).encode();h={'Content-Type':'application/json',**(headers or {})}
  if token:h['Authorization']='Bearer '+token
  req=urllib.request.Request(base+'/api/?route='+urllib.parse.quote(route,safe='/'),data=data,headers=h)
  try:
   with urllib.request.urlopen(req,timeout=5) as r:code=r.status;result=json.load(r)
  except urllib.error.HTTPError as e:code=e.code;result=json.load(e)
  assert code==status,(route,code,result);checks+=1;return result
 def check(v):
  global checks
  assert v;checks+=1
 def toggle(id,active):
  state=request('/manager/plugins',token=admin);request('/manager/plugins',{'id':id,'active':active,'revision':state['revision']},admin)
 try:
  for _ in range(50):
   try:request('/health');break
   except OSError:time.sleep(.05)
  admin=request('/login',{'role':'manager','password':password('Manager password')})['token'];driver=request('/login',{'role':'driver','driverId':'demo-driver','password':password('Driver password')})['token']
  # The per plugin editor shares manager session protection.
  with urllib.request.urlopen(base+'/plugins/edit.php?plugin=square') as r:check('/auth/' in r.url)
  browser=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
  with browser.open(base+'/auth/') as r:csrf=re.search('name="csrf" value="([a-f0-9]+)"',r.read().decode())[1]
  with browser.open(urllib.request.Request(base+'/auth/',data=urllib.parse.urlencode({'csrf':csrf,'username':'admin','password':password('Manager password')}).encode())) as r:check('/orders/' in r.url)
  with browser.open(base+'/plugins/edit.php?plugin=square') as r:
   html=r.read().decode();check('data-edit-plugin="square"' in html and 'data-plugin-edit-activate' in html)
  try:browser.open(base+'/plugins/edit.php?plugin=missing-plugin')
  except urllib.error.HTTPError as e:check(e.code==404)
  else:raise AssertionError('Unknown plugin editor')
  toggle('event-observer',True)
  for id in ['square','paypal','helcim','clover','moneris','authorize-net']:
   route='/manager/plugins/'+id+'/settings';request(route,token=admin,status=404);toggle(id,True)
   request(route,status=401);request(route,token=driver,status=403);request(route,{},driver,status=403)
   state=request(route,token=admin);check(not state['checkoutEnabled'] and state['stage']=='connector')
   body={'revision':state['revision'],'credentials':{f['id']:'test-secret' for f in state['fields']}}
   saved=request(route,body,admin);check(saved['configured'] and 'test-secret' not in json.dumps(saved));request(route,body,admin,status=409)
   request(route,{'revision':saved['revision'],'environment':'live'},admin,status=422)
   request('/manager/plugins/'+id+'/verify',{},driver,status=403)
   if id=='square':
    event={'event_id':'evt-one','type':'payment.updated','data':{}};raw=json.dumps(event).encode();url=base+'/api/?route=/plugins/square/webhook';signature=base64.b64encode(hmac.new(b'test-secret',url.encode()+raw,hashlib.sha256).digest()).decode()
    request('/plugins/square/webhook',event,status=400)
    request('/plugins/square/webhook',event,headers={'X-Square-Hmacsha256-Signature':signature})
    request('/plugins/square/webhook',event,headers={'X-Square-Hmacsha256-Signature':signature});check((work/'events.log').read_text()=='square\\n')
   toggle(id,False);request(route,token=admin,status=404);toggle(id,True);check(request(route,token=admin)['configured']);toggle(id,False)
  print(f'Payment connectors HTTP: {checks} checks passed.')
 finally:proc.terminate();proc.wait()
