"""Test merchant deal settings, authenticated claims, pricing, and delivery collection."""
import datetime,hashlib,json,os,pathlib,socket,sqlite3,subprocess,tempfile,time,urllib.request,urllib.error,uuid
root=pathlib.Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='dyws-deals-api-') as temp:
 work=pathlib.Path(temp);subprocess.run(['php',str(root/'server/setup.php'),str(work)],check=True,stdout=subprocess.DEVNULL)
 with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
 base=f'http://127.0.0.1:{port}';config=json.loads((work/'config.json').read_text());config['public_base_url']=base;config['customer_accounts']={'enabled':True,'from':'accounts@example.test'};(work/'config.json').write_text(json.dumps(config))
 access=(work/'LOCAL-ACCESS.txt').read_text().splitlines();password=lambda key:next(x.split(': ',1)[1]for x in access if x.startswith(key+':'))
 proc=subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t',str(root/'public_html'),str(root/'server/router.php')],env={**os.environ,'DYWS_CONFIG':str(work/'config.json')},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 checks=0
 def call(route,body=None,token=None,customer=None,status=200,headers=None):
  global checks
  h={'Content-Type':'application/json'}
  if token:h['Authorization']='Bearer '+token
  if customer:h.update({'X-DYWS-CUSTOMER':'1','Cookie':cookie+'='+customer,'Origin':base})
  h.update(headers or {})
  req=urllib.request.Request(base+'/api/?route='+route,headers=h,data=None if body is None else json.dumps(body).encode())
  try:
   with urllib.request.urlopen(req,timeout=5) as r:code=r.status;data=json.load(r)
  except urllib.error.HTTPError as e:code=e.code;data=json.load(e)
  assert code==status,(route,code,data);checks+=1;return data
 try:
  for _ in range(50):
   try:call('/health');break
   except OSError:time.sleep(.1)
  admin=call('/login',{'role':'manager','password':password('Manager password')})['token'];driver=call('/login',{'role':'driver','driverId':'demo-driver','password':password('Driver password')})['token']
  catalog=call('/manager/catalog',token=admin);original=json.loads(json.dumps(catalog['catalog']));state=call('/manager/deals',token=admin)
  offer={'id':'breakfast-pair','name':'Breakfast pair','type':'quantity','itemIds':['breakfast0'],'enabled':True,'days':list(range(7)),'startsOn':'2020-01-01','endsOn':'2099-12-31','claimDays':30,'buyQuantity':1,'getQuantity':1,'maxApplications':1}
  call('/manager/deals',{'revision':state['revision'],'deals':[offer]},status=401);call('/manager/deals',{'revision':state['revision'],'deals':[offer]},token=driver,status=403)
  saved=call('/manager/deals',{'revision':state['revision'],'deals':[offer]},token=admin);call('/manager/deals',{'revision':state['revision'],'deals':[offer]},token=admin,status=409)
  after=call('/manager/catalog',token=admin)['catalog'];assert after['categories']==original['categories'] and after['businessName']==original['businessName']
  assert call('/deals')['deals'][0]['activeNow'];call('/customer/deals',status=403)
  publicWallet=call('/customer/deals',headers={'X-DYWS-CUSTOMER':'1'});assert publicWallet['signInRequired'];call('/customer/deals/claim',{'dealId':'breakfast-pair'},headers={'X-DYWS-CUSTOMER':'1'},status=401)
  cookie='dyws_customer_'+hashlib.sha256((config['tenant']+'|'+base).encode()).hexdigest()[:16]
  db=sqlite3.connect(config['database'])
  for n,key in [('a','a'*64),('b','b'*64)]:
   db.execute('INSERT INTO customers(tenant,id,email,created_at,verified_at) VALUES(?,?,?,?,?)',(config['tenant'],n,n+'@example.test',int(time.time()),int(time.time())))
   db.execute('INSERT INTO customer_sessions(tenant,token_hash,customer_id,expires_at) VALUES(?,?,?,?)',(config['tenant'],hashlib.sha256(key.encode()).hexdigest(),n,int(time.time())+3600))
  db.commit();db.close()
  wallet=call('/customer/deals/claim',{'dealId':'breakfast-pair'},customer='a'*64);claim=wallet['activeClaimId'];assert claim
  assert call('/customer/deals/claim',{'dealId':'breakfast-pair'},customer='a'*64)['activeClaimId']==claim
  assert not call('/customer/deals',customer='b'*64)['claims'];call('/customer/deals/activate',{'claimId':claim},customer='b'*64,status=409)
  body={'idempotencyKey':str(uuid.uuid4()),'customer':{'name':'Example Customer','phone':'7805550142'},'lines':[{'id':'breakfast0','quantity':2,'price':1}],'fulfillment':'pickup','dealClaimId':claim,'demoAcknowledged':True}
  quote=call('/customer/deals/quote',body,customer='a'*64);assert quote['discount']==1495 and quote['total']==1570
  call('/customer/deals/quote',body,customer='b'*64,status=409)
  receipt=call('/orders',body,customer='a'*64,status=201);assert receipt['total']==1570
  assert call('/orders',body,customer='a'*64,status=201)['id']==receipt['id']
  call('/orders',{**body,'idempotencyKey':str(uuid.uuid4())},customer='a'*64,status=409)
  order=next(o for o in call('/manager/orders',token=admin)['orders'] if o['id']==receipt['id']);assert order['discount']==1495 and order['deal']['name']=='Breakfast pair' and order['subtotal']==1495
  assert call('/customer/deals',customer='a'*64)['claims'][0]['state']=='used'
  call('/customer/deals/claim',{'dealId':'breakfast-pair'},customer='a'*64,headers={'Origin':'https://elsewhere.test'},status=403)
  # Merchant setting and driver collection use the same ordinary protected routes.
  door={**body,'idempotencyKey':str(uuid.uuid4()),'fulfillment':'delivery','address':'100 Example Avenue','paymentMethod':'pay_at_door'};door.pop('dealClaimId')
  call('/orders',door,status=422)
  data=call('/manager/catalog',token=admin);data['catalog']['allowPayAtDoor']=True;call('/manager/catalog',data,token=admin)
  doorReceipt=call('/orders',door,status=201);id=doorReceipt['id'];assert doorReceipt['paymentProvider']=='pay-at-door'
  call('/driver/orders/'+id+'/payment',{'kind':'capture'},token=driver,status=403)
  call('/manager/orders/'+id+'/assign',{'driverId':'demo-driver'},token=admin)
  for state in ['accepted','preparing','ready']:call('/manager/orders/'+id+'/status',{'status':state},token=admin)
  call('/driver/orders/'+id+'/status',{'status':'out_for_delivery'},token=driver)
  call('/driver/orders/'+id+'/status',{'status':'delivered'},token=driver,status=409)
  call('/driver/orders/'+id+'/payment',{'kind':'capture'},token=driver)
  call('/driver/orders/'+id+'/payment',{'kind':'capture'},token=driver,status=409)
  call('/driver/orders/'+id+'/status',{'status':'delivered'},token=driver)
  pickup={**body,'idempotencyKey':str(uuid.uuid4()),'paymentMethod':'pay_at_restaurant'};pickup.pop('dealClaimId');call('/orders',pickup,status=422)
  data=call('/manager/catalog',token=admin);data['catalog']['allowPayAtPickup']=True;call('/manager/catalog',data,token=admin)
  counter=call('/orders',pickup,status=201);assert counter['paymentProvider']=='pay-at-restaurant' and counter['paymentMethod']=='pay_at_restaurant'
  for state in ['accepted','preparing','ready']:call('/manager/orders/'+counter['id']+'/status',{'status':state},token=admin)
  call('/manager/orders/'+counter['id']+'/status',{'status':'completed'},token=admin,status=409)
  call('/manager/orders/'+counter['id']+'/payment',{'kind':'capture'},token=admin);call('/manager/orders/'+counter['id']+'/status',{'status':'completed'},token=admin)
  print(f'Deal and deferred payment HTTP: {checks} checks passed.')
 finally:proc.terminate();proc.wait(timeout=5)
