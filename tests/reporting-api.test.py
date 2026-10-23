"""Exercise manager authorization and optional reporting plugin lifecycle over HTTP."""
import json,os,pathlib,shutil,socket,subprocess,tempfile,time,urllib.request,urllib.error,urllib.parse
root=pathlib.Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='dyws-report-api-') as temp:
 work=pathlib.Path(temp);subprocess.run(['php',str(root/'server/setup.php'),str(work)],check=True,capture_output=True)
 config=json.loads((work/'config.json').read_text());config['plugins_path']=str(work/'plugins');(work/'config.json').write_text(json.dumps(config));shutil.copytree(root/'plugins',work/'plugins')
 access=(work/'LOCAL-ACCESS.txt').read_text().splitlines();password=lambda key:next(x.split(': ',1)[1]for x in access if x.startswith(key+':'))
 with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
 proc=subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t',str(root/'public_html')],env={**os.environ,'STARLIT_GO_CONFIG':str(work/'config.json')},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 checks=0
 def request(route,body=None,token=None,status=200,query=''):
  global checks
  headers={'Content-Type':'application/json'}
  if token:headers['Authorization']='Bearer '+token
  req=urllib.request.Request(f'http://127.0.0.1:{port}/api/index.php?route='+urllib.parse.quote(route,safe='/')+query,headers=headers,data=None if body is None else json.dumps(body).encode())
  try:
   with urllib.request.urlopen(req,timeout=5) as r:code=r.status;data=json.load(r)
  except urllib.error.HTTPError as e:code=e.code;data=json.load(e)
  assert code==status,(route,code,data);checks+=1;return data
 def check(v):
  global checks
  assert v;checks+=1
 try:
  for _ in range(50):
   try:request('/health');break
   except OSError:time.sleep(.1)
  admin=request('/login',{'role':'manager','password':password('Manager password')})['token'];driver=request('/login',{'role':'driver','driverId':'demo-driver','password':password('Driver password')})['token']
  route='/manager/plugins/order-reporting/dashboard'
  request(route,status=401);request(route,token=driver,status=403)
  data=request(route,token=admin,query='&from=2026-10-01&to=2026-10-07');check(data['range']['days']==7 and len(data['current']['daily'])==7)
  check('orderReporting' in request('/manager/reports',token=admin,query='&from=2026-10-01&to=2026-10-07'))
  request('/manager/reports',token=admin,query='&from[]=invalid',status=422)
  check('orderReportingError' in request('/manager/reports',token=admin,query='&currency[]=CAD'))
  for query in ['&from[]=2026','&from=2026-02-30','&currency[]=CAD','&fulfillment=invalid']:request(route,token=admin,query=query,status=422)
  def toggle(id,active):
   state=request('/manager/plugins',token=admin);request('/manager/plugins',{'id':id,'active':active,'revision':state['revision']},token=admin)
  toggle('datatables',False);check('orderReporting' in request('/manager/reports',token=admin,query='&from=2026-10-01&to=2026-10-07'))
  toggle('order-reporting',False);request(route,token=admin,status=404);check('orderReporting' not in request('/manager/reports',token=admin,query='&from=2026-10-01&to=2026-10-07'))
  toggle('order-reporting',True);check(request(route,token=admin)['schemaVersion']==1)
  print(f'Reporting API: {checks} checks passed.')
 finally:proc.terminate();proc.wait()
