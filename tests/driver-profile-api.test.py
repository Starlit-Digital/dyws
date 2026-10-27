"""Driver cosmetic preferences stay scoped, validated and durable over real HTTP."""
import hashlib,json,os,pathlib,socket,sqlite3,subprocess,tempfile,time,urllib.request,urllib.error,urllib.parse,uuid
root=pathlib.Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='dyws-profile-') as work:
 work=pathlib.Path(work)
 subprocess.run(['php',str(root/'server/setup.php'),str(work)],check=True,capture_output=True)
 access=(work/'LOCAL-ACCESS.txt').read_text().splitlines();manager=next(x.split(': ',1)[1] for x in access if x.startswith('Manager password:'));password=next(x.split(': ',1)[1] for x in access if x.startswith('Driver password:'))
 config=json.loads((work/'config.json').read_text());db=sqlite3.connect(config['database'])
 # Exercise the additive migration from a real existing account database.
 db.execute('ALTER TABLE drivers DROP COLUMN profile_icon');db.commit()
 with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
 server=subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t',str(root/'public_html'),str(root/'server/router.php')],env={**os.environ,'DYWS_CONFIG':str(work/'config.json')},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 checks=0
 def check(value):
  global checks
  assert value;checks+=1
 def request(route,body=None,token=None,tracking=None,status=200):
  global checks
  headers={'Content-Type':'application/json'}
  if token:headers['Authorization']='Bearer '+token
  if tracking:headers['X-Tracking-Token']=tracking
  req=urllib.request.Request(f'http://127.0.0.1:{port}/api/?route='+urllib.parse.quote(route,safe='/'),data=None if body is None else json.dumps(body).encode(),headers=headers)
  try:r=urllib.request.urlopen(req,timeout=5)
  except urllib.error.HTTPError as e:r=e
  with r:code=r.status;data=json.load(r)
  assert code==status,(route,code,data);checks+=1;return data
 try:
  for _ in range(50):
   try:request('/health');break
   except OSError:time.sleep(.05)
  manager_token=request('/login',{'role':'manager','password':manager})['token'];token=request('/login',{'role':'driver','driverId':'demo-driver','password':password})['token']
  for body in [None,{}]:
   request('/driver/profile',body,status=401);request('/driver/profile',body,manager_token,status=403)
  profile=request('/driver/profile',token=token);check(profile['profileIcon']=='car');check(set(profile)=={'id','name','vehicleType','vehicleColor','profileIcon','revision','tips'})
  initial=db.execute('SELECT name,password_hash,active,vehicle_type,vehicle_color FROM drivers WHERE tenant=? AND id=?',(config['tenant'],'demo-driver')).fetchone()
  db.execute("INSERT INTO drivers(tenant,id,name,password_hash,active,profile_icon) VALUES('other','demo-driver','Other','private',1,'suv')");db.commit()
  for icon in ['suv','pickup','van','motorcycle','bicycle','car']:
   previous=profile
   profile=request('/driver/profile',{'profileIcon':icon,'revision':profile['revision'],'id':'someone-else','name':'FORGED','active':False,'password':'FORGED'},token)
   check(profile['profileIcon']==icon and profile['id']=='demo-driver');check(request('/driver/orders',token=token)['profile']==profile)
   request('/driver/profile',{'profileIcon':'van','revision':previous['revision']},token,status=409)
  for icon in ['https://example.test/icon.svg','../car','<svg onload=alert(1)>',{},None,'']:
   request('/driver/profile',{'profileIcon':icon,'revision':profile['revision']},token,status=422)
  check(db.execute('SELECT name,password_hash,active,vehicle_type,vehicle_color FROM drivers WHERE tenant=? AND id=?',(config['tenant'],'demo-driver')).fetchone()==initial)
  check(db.execute("SELECT profile_icon FROM drivers WHERE tenant='other' AND id='demo-driver'").fetchone()[0]=='suv')
  profile=request('/driver/profile',{'profileIcon':'van','revision':profile['revision']},token)
  profile=request('/driver/profile',{'profileIcon':'van','vehicleType':'Toyota Corolla','vehicleColor':'Blue','revision':profile['revision']},token)
  check(profile['vehicleType']=='Toyota Corolla' and profile['vehicleColor']=='Blue')
  for field,value in [('vehicleType','x'*61),('vehicleType',{}),('vehicleColor','Invisible'),('vehicleColor',None),('vehicleColor','<script>')]:
   request('/driver/profile',{'profileIcon':'van',field:value,'revision':profile['revision']},token,status=422)
  check(request('/driver/profile',token=token)==profile)
  cleared=request('/driver/profile',{'profileIcon':'van','vehicleColor':'','vehicleType':'','revision':profile['revision']},token)
  check(cleared['vehicleType']=='' and cleared['vehicleColor']=='')
  # Legacy custom colours remain until the driver selects a replacement.
  db.execute("UPDATE drivers SET vehicle_type='Toyota Corolla',vehicle_color='Midnight metallic' WHERE tenant=? AND id='demo-driver'",(config['tenant'],));db.commit()
  profile=request('/driver/profile',token=token)
  profile=request('/driver/profile',{'profileIcon':'van','vehicleColor':'Midnight metallic','revision':profile['revision']},token)
  check(profile['vehicleColor']=='Midnight metallic')
  profile=request('/driver/profile',{'profileIcon':'van','vehicleColor':'Blue','revision':profile['revision']},token)
  request('/logout',{},token);token=request('/login',{'role':'driver','driverId':'demo-driver','password':password})['token'];check(request('/driver/profile',token=token)['profileIcon']=='van')
  summary=request('/manager/drivers',token=manager_token);check(summary['drivers'][0]['profileIcon']=='van')
  request('/manager/drivers',{'id':'demo-driver','name':profile['name'],'active':True,'password':'','vehicleType':'FORGED','vehicleColor':'Red','revision':summary['revision']},manager_token);check(request('/driver/profile',token=token)==profile)
  item=request('/catalog')['categories'][0]['items'][0]['id'];receipt=request('/orders',{'idempotencyKey':str(uuid.uuid4()),'demoAcknowledged':True,'customer':{'name':'Fictional Guest','phone':'7805550142'},'tip':500,'fulfillment':'delivery','address':'123 Example Street','lines':[{'id':item,'quantity':1}]},status=201)
  request('/manager/orders/'+receipt['id']+'/assign',{'driverId':'demo-driver'},manager_token)
  check(request('/tracking/'+receipt['id'],tracking=receipt['trackingToken'])['driver']=={'name':profile['name'],'profileIcon':'van','vehicleType':'Toyota Corolla','vehicleColor':'Blue'})
  check(db.execute('SELECT name,password_hash,active FROM drivers WHERE tenant=? AND id=?',(config['tenant'],'demo-driver')).fetchone()==initial[:3])
  check(db.execute("SELECT vehicle_type,vehicle_color FROM drivers WHERE tenant='other' AND id='demo-driver'").fetchone()==('',''))
  # Existing driver sessions in another tenant cannot cross into this installation.
  foreign='e'*64;db.execute('INSERT INTO sessions VALUES(?,?,?,?,?)',(hashlib.sha256(foreign.encode()).hexdigest(),'other','driver','demo-driver',int(time.time())+500));db.commit();request('/driver/profile',token=foreign,status=401)
  check(receipt['tip']==500)
  check(request('/driver/profile',token=token)['tips']['currencies']==[])
  for state in ['accepted','preparing','ready','out_for_delivery']:
   request('/manager/orders/'+receipt['id']+'/status',{'status':state},manager_token)
  request('/manager/orders/'+receipt['id']+'/payment',{'kind':'capture'},manager_token)
  request('/manager/orders/'+receipt['id']+'/status',{'status':'delivered'},manager_token)
  earned=request('/driver/profile',token=token)['tips']
  check(earned['currencies'][0]['periods']['allTime']['net']==500)
  check(earned['recentOrders'][0]['id']==receipt['id'])
  request('/manager/orders/'+receipt['id']+'/payment',{'kind':'refund'},manager_token)
  adjusted=request('/driver/profile',token=token)['tips']['currencies'][0]['periods']['allTime']
  check(adjusted['gross']==500 and adjusted['refunded']==500 and adjusted['net']==0)
  check(request('/manager/drivers',token=manager_token)['drivers'][0]['tipTotals'][0]['periods']['allTime']==adjusted)
  check(db.execute('PRAGMA integrity_check').fetchone()[0]=='ok')
  print(f'Driver profiles HTTP: {checks} checks passed.')
 finally:server.terminate();server.wait(timeout=5);db.close()
