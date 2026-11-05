"""Manager status correction authorization and revision checks over the real API."""
import json, os, pathlib, socket, subprocess, tempfile, time, urllib.request, urllib.error, uuid
root=pathlib.Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='dyws-status-api-') as temp:
 work=pathlib.Path(temp);subprocess.run(['php',str(root/'server/setup.php'),str(work)],check=True,capture_output=True)
 config=json.loads((work/'config.json').read_text());config['plugins_path']=str(root/'plugins');(work/'config.json').write_text(json.dumps(config))
 access=(work/'LOCAL-ACCESS.txt').read_text().splitlines()
 def password(key):return next(s.split(': ',1)[1] for s in access if s.startswith(key+':'))
 with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
 proc=subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t',str(root/'public_html'),str(root/'server/router.php')],env={**os.environ,'DYWS_CONFIG':str(work/'config.json')},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 checks=0
 def api(route,body=None,token=None,expected=200):
  global checks
  request=urllib.request.Request(f'http://127.0.0.1:{port}/api/?route='+route,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json',**({'Authorization':'Bearer '+token} if token else {})})
  try:
   with urllib.request.urlopen(request,timeout=5) as r:code=r.status;data=json.load(r)
  except urllib.error.HTTPError as e:code=e.code;data=json.load(e)
  assert code==expected,(route,code,data);checks+=1;return data
 try:
  for _ in range(50):
   try:api('/health');break
   except OSError:time.sleep(.1)
  manager=api('/login',{'role':'manager','password':password('Manager password')})['token'];driver=api('/login',{'role':'driver','driverId':'demo-driver','password':password('Driver password')})['token']
  order=api('/orders',{'idempotencyKey':str(uuid.uuid4()),'customer':{'name':'Fictional Status Guest','phone':'7805550142'},'fulfillment':'pickup','lines':[{'id':'breakfast0','variant':'','quantity':1}],'demoAcknowledged':True},expected=201)
  route='/manager/orders/'+order['id']+'/status-history'
  api(route,expected=401);api(route,token=driver,expected=403)
  history=api(route,token=manager);assert not history['canUndo']
  changed=api(route,{'action':'set','status':'accepted','revision':history['revision']},manager);assert changed['order']['status']=='accepted'
  api(route,{'action':'undo','revision':history['revision']},manager,expected=409)
  undo=api(route,{'action':'undo','revision':changed['history']['revision']},manager);assert undo['order']['status']=='placed' and undo['history']['canRedo']
  redo=api(route,{'action':'redo','revision':undo['history']['revision']},manager);assert redo['order']['status']=='accepted'
  api(route,{'action':'set','status':'completed','revision':redo['history']['revision']},manager,expected=409)
  orders=api('/manager/orders',token=manager)['orders'];assert next(o for o in orders if o['id']==order['id'])['statusControls']['current']=='accepted'
  print(f'Status history API: {checks} HTTP checks passed.')
 finally:proc.terminate();proc.wait(timeout=5)
