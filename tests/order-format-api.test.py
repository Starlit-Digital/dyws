"""Order template authorization, assignment and disabled fallback over HTTP."""
import copy,http.cookiejar,json,os,pathlib,re,shutil,socket,subprocess,tempfile,time,urllib.request,urllib.error,urllib.parse
root=pathlib.Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='dyws-format-api-') as temp:
 work=pathlib.Path(temp);subprocess.run(['php',str(root/'server/setup.php'),str(work)],check=True,capture_output=True)
 config=json.loads((work/'config.json').read_text());config['plugins_path']=str(work/'plugins');(work/'config.json').write_text(json.dumps(config));shutil.copytree(root/'plugins',work/'plugins')
 access=(work/'LOCAL-ACCESS.txt').read_text().splitlines();password=lambda key:next(x.split(': ',1)[1]for x in access if x.startswith(key+':'))
 with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
 base=f'http://127.0.0.1:{port}';route='/manager/plugins/order-format/templates'
 proc=subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t',str(root/'public_html'),str(root/'server/router.php')],env={**os.environ,'DYWS_CONFIG':str(work/'config.json')},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 checks=0
 def request(path,body=None,token=None,status=200,query=''):
  global checks
  headers={'Content-Type':'application/json'}
  if token:headers['Authorization']='Bearer '+token
  req=urllib.request.Request(base+'/api/?route='+urllib.parse.quote(path,safe='/')+query,headers=headers,data=None if body is None else json.dumps(body).encode())
  try:
   with urllib.request.urlopen(req,timeout=5) as r:code=r.status;data=json.load(r)
  except urllib.error.HTTPError as e:code=e.code;data=json.load(e)
  assert code==status,(path,code,data);checks+=1;return data
 def check(v):
  global checks
  assert v;checks+=1
 try:
  for _ in range(50):
   try:request('/health');break
   except OSError:time.sleep(.05)
  admin=request('/login',{'role':'manager','password':password('Manager password')})['token'];driver=request('/login',{'role':'driver','driverId':'demo-driver','password':password('Driver password')})['token']
  def toggle(active):
   state=request('/manager/plugins',token=admin);request('/manager/plugins',{'id':'order-format','active':active,'revision':state['revision']},token=admin)
  request('/plugins/order-format/layouts',status=404);toggle(True)
  request(route,status=401);request(route,token=driver,status=403);request(route,{},status=401);request(route,{},driver,status=403)
  data=request(route,token=admin);check(data['templates']==[] and not request('/plugins/order-format/layouts')['layouts'])
  check('order-format' in [p['id'] for p in request('/plugins',query='&page=storefront')['plugins']])
  # Saving a named draft does not change the customer layout.
  fields=[{'id':f['id'],'row':i+1,'column':1,'span':2,'align':'center','vertical':'top'}for i,f in enumerate(data['schema']['review']['fields'])]
  template={'id':'review-example','name':'Private draft name','stage':'review','layout':{'rows':len(fields),'fields':fields}}
  data['templates']=[template];saved=request(route,data,admin);check(not request('/plugins/order-format/layouts')['layouts'])
  request(route,data,admin,status=409)
  bad=copy.deepcopy(saved);bad['assignments']['checkout']=template['id'];request(route,bad,admin,status=422)
  bad=copy.deepcopy(saved);bad['templates'][0]['layout']['fields']=fields[:-1];request(route,bad,admin,status=422)
  saved['assignments']['review']=template['id'];saved=request(route,saved,admin)
  public=request('/plugins/order-format/layouts');check(public['layouts']['review']==template['layout']);check('Private draft name' not in json.dumps(public) and 'revision' not in public)
  # Editor has the same session protection as the other manager pages.
  with urllib.request.urlopen(base+'/plugins/order-format/editor.php') as r:check('/auth/' in r.url and 'data-format-editor' not in r.read().decode())
  browser=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
  with browser.open(base+'/auth/') as r:csrf=re.search('name="csrf" value="([a-f0-9]+)"',r.read().decode())[1]
  with browser.open(urllib.request.Request(base+'/auth/',data=urllib.parse.urlencode({'csrf':csrf,'username':'admin','password':password('Manager password')}).encode())) as r:check('/orders/' in r.url)
  with browser.open(base+'/plugins/order-format/editor.php') as r:check('data-order-format-active="true"' in r.read().decode())
  toggle(False);request('/plugins/order-format/layouts',status=404);request(route,token=admin,status=404)
  with browser.open(base+'/plugins/order-format/editor.php') as r:check('data-order-format-active="false"' in r.read().decode())
  check('order-format' not in [p['id'] for p in request('/plugins',query='&page=storefront')['plugins']])
  check(request('/catalog')['categories'])
  toggle(True);check(request(route,token=admin)['revision']==saved['revision']);check(request('/plugins/order-format/layouts')==public)
  print(f'Order Format HTTP: {checks} checks passed.')
 finally:proc.terminate();proc.wait()
