"""Private driver and tracking pages render authorized data before JavaScript runs."""
import html,json,http.cookiejar,hashlib,os,pathlib,re,socket,sqlite3,subprocess,tempfile,time,urllib.request,urllib.parse,urllib.error,uuid
root=pathlib.Path(__file__).resolve().parents[1]
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args):return None
with tempfile.TemporaryDirectory(prefix='dyws-pages-') as work:
 subprocess.run(['php',str(root/'server/setup.php'),work],check=True,capture_output=True)
 access=(pathlib.Path(work)/'LOCAL-ACCESS.txt').read_text().splitlines()
 password=next(x.split(': ',1)[1] for x in access if x.startswith('Driver password:'))
 manager=next(x.split(': ',1)[1] for x in access if x.startswith('Manager password:'))
 config=json.loads((pathlib.Path(work)/'config.json').read_text())
 with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
 base=f'http://127.0.0.1:{port}'
 server=subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t',str(root/'public_html'),str(root/'server/router.php')],env={**os.environ,'DYWS_CONFIG':work+'/config.json'},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 jar=http.cookiejar.CookieJar();browser=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar),NoRedirect());plain=urllib.request.build_opener(NoRedirect());checks=0
 def req(path,data=None,headers=None,client=None):
  try:r=(client or browser).open(urllib.request.Request(base+path,data=data,headers=headers or {}),timeout=5)
  except urllib.error.HTTPError as e:r=e
  with r:return r.status,r.headers,r.read().decode()
 def check(value):
  global checks
  assert value;checks+=1
 def form(path,data):return req(path,urllib.parse.urlencode(data).encode(),{'Content-Type':'application/x-www-form-urlencoded'})
 def api(route,data=None,token=None):
  status,_,body=req('/api/?route='+urllib.parse.quote(route,safe='/'),None if data is None else json.dumps(data).encode(),{'Content-Type':'application/json',**({'Authorization':'Bearer '+token}if token else {})});assert status in [200,201],body;return json.loads(body)
 def boot(body):return json.loads(html.unescape(re.search(r'name="dyws-page-data" content="([^"]+)"',body)[1]))
 try:
  for i in range(50):
   try:
    if req('/api/?route=/health')[0]==200:break
   except OSError:pass
   time.sleep(.05)
  status,_,body=req('/driver/');check(status==200 and 'method="post"' in body and 'dyws-page-data' not in body and 'platform/driver' not in body)
  csrf=re.search(r'name="csrf" value="([a-f0-9]{64})"',body)[1]
  check(form('/driver/',{'csrf':'bad','driverId':'demo-driver','password':password})[0]==403)
  _,_,body=req('/driver/');csrf=re.search(r'name="csrf" value="([a-f0-9]{64})"',body)[1]
  status,headers,_=form('/driver/',{'csrf':csrf,'driverId':'demo-driver','password':password});check(status==303 and headers['Location']=='/driver/')
  token=next(c.value for c in jar if c.name=='dyws_driver_session')
  cookie=next(c for c in jar if c.name=='dyws_driver_session');check(cookie.has_nonstandard_attr('HttpOnly') and cookie.get_nonstandard_attr('SameSite')=='Lax')
  mt=api('/login',{'role':'manager','password':manager})['token']
  cat=api('/catalog');item=cat['categories'][0]['items'][0]['id']
  def order(name):return api('/orders',{'idempotencyKey':str(uuid.uuid4()),'demoAcknowledged':True,'lines':[{'id':item,'variant':'','quantity':1}],'fulfillment':'delivery','customer':{'name':name,'phone':'7805550142'},'addressDetails':{'line1':'123 Test Street','line2':'','city':'Edmonton','region':'AB','postalCode':'T5A 1A1','country':'Canada'}})
  one=order('Visible Test Customer');two=order('Other Private Customer')
  api('/manager/orders/'+one['id']+'/assign',{'driverId':'demo-driver'},mt)
  for state in ['accepted','preparing','ready']:api('/manager/orders/'+one['id']+'/status',{'status':state},mt)
  status,headers,body=req('/driver/');data=boot(body)
  check(status==200 and 'Visible Test Customer' in body and 'Other Private Customer' not in body)
  check([o['id'] for o in data['responses']['/driver/orders']['orders']]==[one['id']])
  check('data-dyws-skeleton' in body and 'modulepreload' in body and 'initial_data' in headers['Server-Timing'])
  check(config['tracking_secret'] not in body and password not in body and '/manager/orders' not in data['responses'])
  check('dyws-page-data' not in req('/driver/',headers={'Cookie':'dyws_driver_session='+mt},client=plain)[2])
  db=sqlite3.connect(config['database']);other='f'*64;db.execute('INSERT INTO sessions VALUES(?,?,?,?,?)',(hashlib.sha256(other.encode()).hexdigest(),'other-tenant','driver','demo-driver',int(time.time())+500));db.commit()
  check('dyws-page-data' not in req('/driver/',headers={'Cookie':'dyws_driver_session='+other},client=plain)[2])
  check(req('/tracking/?order='+one['id'],client=plain)[0]==404)
  check(form('/tracking/',{'orderId':one['id'],'trackingToken':two['trackingToken']})[0]==404)
  status,headers,_=form('/tracking/',{'orderId':one['id'],'trackingToken':one['trackingToken']})
  check(status==303 and headers['Location']=='/tracking/?order='+one['id'] and one['trackingToken'] not in headers['Location'])
  tc=next(c for c in jar if c.name.startswith('dyws_track_'));check(tc.has_nonstandard_attr('HttpOnly') and tc.path=='/tracking/')
  status,headers,body=req(headers['Location']);data=boot(body)
  check(status==200 and 'Ready for delivery' in body and 'no-store' in headers['Cache-Control'] and headers['Referrer-Policy']=='no-referrer')
  check(data['responses']['/tracking/'+one['id']]['status']=='ready' and two['id'] not in body and 'Other Private Customer' not in body)
  check('customer_phone' not in body and 'tracking_secret' not in body and 'data-dyws-initial-preview' in body)
  check(req('/tracking/?order='+two['id'])[0]==404)
  db.execute('UPDATE orders SET tracking_expires=0 WHERE id=?',(one['id'],));db.commit();check(req('/tracking/?order='+one['id'])[0]==404)
  api('/logout',{},token);check('dyws-page-data' not in req('/driver/')[2])
  check('dyws-page-data' not in req('/driver/',headers={'Cookie':'dyws_driver_session='+token},client=plain)[2])
  print(f'Customer and driver startup HTTP: {checks} checks passed.')
 finally:server.terminate();server.wait(timeout=5)
