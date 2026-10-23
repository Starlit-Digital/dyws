"""Fresh web installation, protected setup, self removal, and SQLite persistence."""
import contextlib, http.cookiejar, json, os, pathlib, re, shutil, socket, sqlite3, subprocess, tempfile, time, urllib.request, urllib.error, urllib.parse, zipfile
root=pathlib.Path(__file__).resolve().parents[1]
checks=0
def check(ok,message):
 global checks
 assert ok,message
 checks+=1
with tempfile.TemporaryDirectory(prefix='dyws-install-') as tmp:
 base=pathlib.Path(tmp)/'dyws'
 archive=os.environ.get('DYWS_INSTALL_ARCHIVE')
 if archive:
  with zipfile.ZipFile(archive) as z:z.extractall(tmp)
 else:
  base.mkdir()
  for folder in ['public_html','server','examples','plugins']:
   shutil.copytree(root/folder,base/folder,ignore=shutil.ignore_patterns('bootstrap-path.php'))
  shutil.copytree(root/'modules/dyws/php',base/'modules/dyws/php')
  (base/'vendor').symlink_to(root/'vendor',target_is_directory=True)
  (base/'var').mkdir(mode=0o700)
 with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
 url=f'http://127.0.0.1:{port}'
 env={k:v for k,v in os.environ.items() if k not in ['DYWS_CONFIG','DYWS_BOOTSTRAP']}
 server=subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t',str(base/'public_html'),str(base/'server/router.php')],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
 def request(path,body=None,status=200,headers=None):
  req=urllib.request.Request(url+path,data=urllib.parse.urlencode(body).encode() if body is not None else None,headers=headers or {})
  try:
   with client.open(req,timeout=8) as r:code,text,final=r.status,r.read().decode(),r.url
  except urllib.error.HTTPError as e:code,text,final=e.code,e.read().decode(),e.url
  check(code==status,(path,code,text[:400]))
  return text,final
 try:
  for _ in range(60):
   try:html,final=request('/');break
   except (OSError,urllib.error.URLError):time.sleep(.05)
  else:raise AssertionError('Server failed to start')
  check(final.endswith('/setup/'),'Unconfigured home redirects to setup')
  key=(base/'var/setup-key.txt').read_text().strip()
  check(key not in html,'Setup key is never exposed over HTTP')
  csrf=re.search(r'name="csrf" value="([a-f0-9]+)"',html).group(1)
  request('/setup/',{'step':'unlock','key':key,'csrf':'wrong'},403)
  request('/setup/',{'step':'unlock','key':'wrong','csrf':csrf},403)
  request('/setup/',{'step':'install','csrf':csrf},403)
  html,_=request('/setup/',{'step':'unlock','key':key,'csrf':csrf})
  check('Admin password' in html,'Owner unlocks account setup')
  fields={'step':'install','csrf':csrf,'businessName':'Example & Co','baseUrl':url,'password':'example-password-234','confirmPassword':'example-password-234','catalog':'empty'}
  request('/setup/',{**fields,'confirmPassword':'different'},422)
  check(not (base/'var/config.json').exists(),'Invalid form creates no installation')
  request('/setup/',{**fields,'baseUrl':'http://public.example'},422)
  html,_=request('/setup/',fields)
  check('Ready to go' in html and 'Setup has been removed.' in html,'Installation completes')
  check(not (base/'public_html/setup').exists(),'Entire setup folder removed')
  check(not (base/'var/setup-key.txt').exists(),'One time key removed')
  check((base/'var/installed.lock').exists(),'Durable installation lock remains')
  config=json.loads((base/'var/config.json').read_text())
  check('drivers' not in config and 'manager_password_hash' not in config,'JSON config has no account records')
  check(config['site_template']=='shop','Empty catalog selects generic storefront')
  check(json.loads((base/'var/catalog.json').read_text())['categories']==[],'Empty catalog supported')
  db=sqlite3.connect(config['database'])
  check(db.execute('SELECT count(*) FROM admin_credentials').fetchone()[0]==1,'Admin is persisted in SQLite')
  check(db.execute('SELECT count(*) FROM drivers').fetchone()[0]==0,'No default driver account')
  request('/setup/',status=404)
  # Even reuploading setup cannot overwrite or take over an existing installation.
  shutil.copytree(root/'public_html/setup',base/'public_html/setup')
  request('/setup/',status=404)
  request('/setup/',fields,status=404)
  def api(route,body,token=None,status=200):
   headers={'Content-Type':'application/json'}
   if token:headers['Authorization']='Bearer '+token
   req=urllib.request.Request(url+'/api/?route='+route,data=json.dumps(body).encode(),headers=headers)
   try:
    with client.open(req,timeout=8) as r:code,data=r.status,json.load(r)
   except urllib.error.HTTPError as e:code,data=e.code,json.load(e)
   check(code==status,(route,code,data));return data
  session=api('/login',{'role':'manager','password':fields['password']})
  token=session['token']
  req=urllib.request.Request(url+'/api/?route=/manager/drivers',headers={'Authorization':'Bearer '+token})
  with client.open(req) as r:drivers=json.load(r)
  api('/manager/drivers',{'id':'courier','name':'Example courier','password':'courier-password-234','active':True,'revision':drivers['revision'],'create':True},token)
  api('/login',{'role':'driver','driverId':'courier','password':'courier-password-234'})
  check(db.execute('SELECT name FROM drivers WHERE id=?',('courier',)).fetchone()[0]=='Example courier','Driver saved to SQLite after web install')
  check(not list((base/'var').glob('accounts-*.json')),'Driver edit does not create account JSON')
  html,_=request('/')
  check('Example &amp; Co' in html and 'Starlit Diner' not in html,'Generic storefront uses business name')
  for path in ['/var/config.json','/var/orders.sqlite','/server/setup.php','/.git/config']:
   request(path,status=404)
  def get_api(route):
   req=urllib.request.Request(url+'/api/?route='+route,headers={'Authorization':'Bearer '+token})
   with client.open(req) as r:return json.load(r)
  plugin_manifest=get_api('/plugins')
  check(sorted(p['id'] for p in plugin_manifest['plugins'])==['datatables','google-maps','order-reporting','stripe'],'All bundled plugins discovered after fresh install')
  check(len(plugin_manifest['hooks'])==32,'Installed hook catalog available')
  draft=get_api('/manager/catalog');draft['catalog']['categories']=[{'id':'goods','name':'Goods','items':[{'id':'sample','name':'Example item','price':500,'description':'','active':True,'unit':'each'}]}]
  api('/manager/catalog',draft,token)
  order=api('/orders',{'demoAcknowledged':True,'idempotencyKey':'install-test-1234567890','customer':{'name':'Example Customer','phone':'7805550142'},'fulfillment':'pickup','lines':[{'id':'sample','variant':'','quantity':1}]},status=201)
  check(db.execute('SELECT total FROM orders WHERE id=?',(order['id'],)).fetchone()[0]==500,'New orders are persisted in SQLite')
  settings=get_api('/manager/settings');settings['settings']['driverRole']={'singular':'Handler','plural':'Handlers'}
  api('/manager/settings',settings,token)
  settings_path=next((base/'var').glob('settings-*.json'))
  check(json.loads(settings_path.read_text())['driverRole']['singular']=='Handler','Overall settings stay in JSON')
  db.close()
 finally:
  server.terminate();server.wait(timeout=5)
print(f'Installer HTTP: {checks} checks passed.')
