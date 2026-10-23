"""Admin page access must be enforced by PHP before sending markup."""
import html as html_parser,hashlib,http.cookiejar,json,os,pathlib,re,socket,sqlite3,subprocess,tempfile,time,urllib.request,urllib.error,urllib.parse
root=pathlib.Path(__file__).resolve().parents[1]
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args):return None
with tempfile.TemporaryDirectory(prefix='dyws-auth-') as work:
 subprocess.run(['php',str(root/'server/setup.php'),work],check=True,capture_output=True)
 access=(pathlib.Path(work)/'LOCAL-ACCESS.txt').read_text().splitlines()
 password=next(x.split(': ',1)[1] for x in access if x.startswith('Manager password:'))
 driver=next(x.split(': ',1)[1] for x in access if x.startswith('Driver password:'))
 config=json.loads((pathlib.Path(work)/'config.json').read_text())
 with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
 base=f'http://127.0.0.1:{port}'
 process=subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t',str(root/'public_html'),str(root/'server/router.php')],env={**os.environ,'DYWS_CONFIG':work+'/config.json'},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 jar=http.cookiejar.CookieJar();browser=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar),NoRedirect());plain=urllib.request.build_opener(NoRedirect());checks=0
 def req(path,data=None,headers=None,client=None):
  request=urllib.request.Request(base+path,data=data,headers=headers or {})
  try:r=(client or browser).open(request,timeout=4)
  except urllib.error.HTTPError as e:r=e
  with r:return r.status,r.headers,r.read().decode()
 def check(value):
  global checks
  assert value;checks+=1
 def csrf():
  status,headers,html=req('/auth/')
  check(status==200 and '<header' not in html and '<nav' not in html and 'Live updates' not in html and 'platform/' not in html)
  return re.search(r'name="csrf" value="([a-f0-9]{64})"',html)[1]
 def login(password_value=password,csrf_value=None):
  return req('/auth/',urllib.parse.urlencode({'csrf':csrf_value if csrf_value is not None else csrf(),'password':password_value}).encode(),{'Content-Type':'application/x-www-form-urlencoded'})
 def api(route,body=None,token=None):
  headers={'Content-Type':'application/json'}
  if token:headers['Authorization']='Bearer '+token
  return req('/api/?route='+route,None if body is None else json.dumps(body).encode(),headers)
 pages=['admin','orders','reports','catalog','drivers','password','settings','plugins']
 try:
  for i in range(50):
   try:
    if req('/api/?route=/health')[0]==200:break
   except OSError:pass
   time.sleep(.05)
  for page in pages:
   for suffix in ['','page.php']:
    status,headers,html=req('/'+page+'/'+suffix)
    check(status==302 and headers['Location']=='/auth/' and '<header' not in html and '<nav' not in html)
  for plugin in ['google-maps','stripe']:
   check(req('/plugins/'+plugin+'/settings.php')[0]==302)
  check(req('/admin')[1]['Location']=='/admin/')
  status,headers,html=login('wrong-password')
  check(status==401 and 'Incorrect sign in' in html and '<header' not in html)
  check(login(csrf_value='invalid')[0]==403)
  status,headers,html=login()
  check(status==303 and headers['Location']=='/orders/' and not html)
  cookie=next(c for c in jar if c.name=='dyws_admin_session')
  check(cookie.get_nonstandard_attr('HttpOnly') is None and cookie.has_nonstandard_attr('HttpOnly') and cookie.get_nonstandard_attr('SameSite')=='Lax' and cookie.path=='/')
  token=cookie.value
  for page in pages[1:]:
   status,headers,html=req('/'+page+'/')
   check(status==200 and '<header' in html and 'dyws-admin-token' in html and token in html and 'login-form' not in html and 'no-store' in headers['Cache-Control'])
   boot=json.loads(html_parser.unescape(re.search(r'name="dyws-admin-data" content="([^"]+)"',html)[1]))
   check(boot['page']==page and '/settings' in boot['responses'] and config['tracking_secret'] not in html and password not in html and 'data-dyws-skeleton' in html)
   check('modulepreload' in html and 'initial_data' in headers['Server-Timing'])
   if page=='orders':check('data-dyws-order-initial' in html and '/manager/orders' in boot['responses'])
   if page=='settings':check('id="maps-form"' in html and 'id="stripe-form"' in html and '/manager/plugins/stripe/settings' in boot['responses'])
  check(req('/admin/')[1]['Location']=='/orders/')
  check(req('/auth/')[1]['Location']=='/orders/')
  # Page cookies never authorize API mutations without their explicit bearer token.
  check(api('/manager/orders')[0]==401)
  check(api('/manager/orders',token=token)[0]==200)
  # Another driver or tenant cannot unlock the administrator UI.
  status,_,body=api('/login',{'role':'driver','driverId':'demo-driver','password':driver})
  driver_token=json.loads(body)['token']
  check(req('/orders/',headers={'Cookie':'dyws_admin_session='+driver_token},client=plain)[0]==302)
  db=sqlite3.connect(config['database']);db.execute("INSERT INTO sessions VALUES(?,?,?,?,?)",(hashlib.sha256(('f'*64).encode()).hexdigest(),'other-tenant','manager','manager',int(time.time())+500));db.commit()
  check(req('/orders/',headers={'Cookie':'dyws_admin_session='+'f'*64},client=plain)[0]==302)
  # Revoked/expired sessions redirect instead of returning any admin markup.
  check(api('/logout',{},token)[0]==200)
  check(req('/orders/')[1]['Location']=='/auth/')
  check(req('/orders/',headers={'Cookie':'dyws_admin_session='+token},client=plain)[0]==302)
  check(login()[0]==303)
  db.execute("UPDATE sessions SET expires_at=0 WHERE role='manager'");db.commit()
  check(req('/settings/')[1]['Location']=='/auth/')
  check(csrf())
  print(f'Admin authentication HTTP: {checks} checks passed.')
 finally:process.terminate();process.wait(timeout=5)
