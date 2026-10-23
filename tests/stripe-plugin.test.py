"""Exercise plugin payment boundaries through HTTP without contacting Stripe."""
import hashlib,hmac,json,os,pathlib,socket,sqlite3,subprocess,tempfile,time,urllib.request,urllib.error,uuid
root=pathlib.Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='dyws-stripe-plugin-') as work:
 work=pathlib.Path(work)
 subprocess.run(['php',str(root/'server/setup.php'),str(work)],check=True,capture_output=True)
 config=json.loads((work/'config.json').read_text());config['public_base_url']='https://example.test/diner';(work/'config.json').write_text(json.dumps(config))
 access=(work/'LOCAL-ACCESS.txt').read_text().splitlines()
 manager=next(x.split(': ',1)[1] for x in access if x.startswith('Manager password:'))
 driver=next(x.split(': ',1)[1] for x in access if x.startswith('Driver password:'))
 with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
 server=subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t',str(root/'public_html')],env={**os.environ,'STARLIT_GO_CONFIG':str(work/'config.json')},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 checks=0
 def request(route,body=None,token=None,tracking=None,status=200,signature=None,raw=None):
  global checks
  headers={}
  if body is not None or raw is not None:headers['Content-Type']='application/json'
  if token:headers['Authorization']='Bearer '+token
  if tracking:headers['X-Tracking-Token']=tracking
  if signature:headers['Stripe-Signature']=signature
  req=urllib.request.Request(f'http://127.0.0.1:{port}/api/index.php?route='+urllib.parse.quote(route,safe='/'),data=raw if raw is not None else None if body is None else json.dumps(body).encode(),headers=headers)
  try:
   with urllib.request.urlopen(req,timeout=5) as r:code=r.status;data=json.load(r)
  except urllib.error.HTTPError as e:code=e.code;data=json.load(e)
  assert code==status,(route,code,data);checks+=1;return data
 def check(value):
  global checks
  assert value;checks+=1
 def toggle(active):
  state=request('/manager/plugins',token=admin)
  return request('/manager/plugins',{'id':'stripe','active':active,'revision':state['revision']},token=admin)
 try:
  for _ in range(40):
   try:request('/health');break
   except (OSError,urllib.error.URLError):time.sleep(.05)
  admin=request('/login',{'role':'manager','password':manager})['token']
  driver_token=request('/login',{'role':'driver','driverId':'demo-driver','password':driver})['token']
  for endpoint in ['/manager/plugins/stripe/settings','/manager/plugins/stripe/verify']:
   request(endpoint,{} if endpoint.endswith('verify') else None,status=401)
   request(endpoint,{} if endpoint.endswith('verify') else None,token=driver_token,status=403)
  secret='whsec_'+uuid.uuid4().hex;key='rk_test_'+uuid.uuid4().hex
  saved=request('/manager/plugins/stripe/settings',{'enabled':True,'apiKey':key,'webhookSecret':secret},token=admin)
  check(saved['enabled'] and saved['hasApiKey'] and 'apiKey' not in saved)
  check(request('/manager/stripe',token=admin)==saved)
  encrypted=(work/'stripe.json').read_bytes();check(key.encode() not in encrypted and secret.encode() not in encrypted)
  # Backward compatible default adoption does not reactivate Maps or override an explicit Stripe disable.
  statefile=next(work.glob('plugins-*.json'),work/('plugins-'+hashlib.sha256(config['tenant'].encode()).hexdigest()[:16]+'.json'))
  statefile.write_text(json.dumps({'active':[]}))
  check(sorted(p['id'] for p in request('/plugins')['plugins'])==['datatables','order-reporting','stripe'])
  body={'demoAcknowledged':True,'idempotencyKey':str(uuid.uuid4()),'customer':{'name':'Test Shopper','phone':'7805550100'},'fulfillment':'pickup','lines':[{'id':request('/catalog')['categories'][0]['items'][0]['id'],'variant':'','quantity':1}]}
  receipt=request('/orders',body,status=201);order=receipt['id'];tracking=receipt['trackingToken']
  check(receipt['paymentProvider']=='stripe')
  request('/plugins/stripe/orders/'+order+'/checkout',{},tracking='invalid',status=404)
  request('/orders/'+order+'/checkout',{},tracking='invalid',status=404)
  request('/plugins/stripe/orders/invalid/checkout',{},tracking=tracking,status=404)
  request('/plugins/stripe/webhook',{},status=400)
  request('/stripe/webhook',{},status=400)
  # Seed an existing Checkout attempt, avoiding any network or real payment.
  db=sqlite3.connect(config['database']);nonce=uuid.uuid4().hex
  db.execute("INSERT INTO payment_attempts(tenant,order_id,nonce,session_id,checkout_url,status,amount,currency,created_at) VALUES(?,?,?,?,?,'open',?,?,?)",(config['tenant'],order,nonce,'cs_test_plugin','https://checkout.stripe.com/c/pay/example',receipt['total'],receipt['currency'],int(time.time())));db.commit()
  result=request('/plugins/stripe/orders/'+order+'/checkout',{},tracking=tracking)
  check(result==request('/orders/'+order+'/checkout',{},tracking=tracking))
  pending={'id':'evt_plugin_pending','type':'checkout.session.completed','livemode':False,'data':{'object':{'id':'cs_test_plugin','client_reference_id':order,'metadata':{'tenant':config['tenant'],'order_id':order,'attempt':nonce},'amount_total':receipt['total'],'currency':receipt['currency'].lower(),'payment_status':'unpaid','payment_intent':'pi_plugin'}}}
  def send(event,endpoint='/plugins/stripe/webhook',status=200):
   # Whitespace and size deliberately preserved to check raw body verification.
   event['padding']='x'*40000
   raw=json.dumps(event,indent=2).encode();now=str(int(time.time()));signature='t='+now+',v1='+hmac.new(secret.encode(),now.encode()+b'.'+raw,hashlib.sha256).hexdigest()
   return request(endpoint,raw=raw,signature=signature,status=status)
  send(pending)
  check(request('/tracking/'+order,tracking=tracking)['checkoutStatus']=='pending')
  toggle(False)
  check(sorted(p['id'] for p in request('/plugins')['plugins'])==['datatables','order-reporting'])
  check((work/'stripe.json').read_bytes()==encrypted)
  request('/manager/plugins/stripe/settings',token=admin,status=404)
  request('/plugins/stripe/orders/'+order+'/checkout',{},tracking=tracking,status=404)
  request('/orders/'+order+'/checkout',{},tracking=tracking,status=404)
  request('/manager/orders/'+order+'/payment',{'kind':'capture'},token=admin,status=409)
  request('/manager/orders/'+order+'/status',{'status':'accepted'},token=admin,status=409)
  check(request('/orders',body,status=201)['paymentProvider']=='stripe')
  body['idempotencyKey']=str(uuid.uuid4());check(request('/orders',body,status=201)['paymentProvider']=='demo')
  # Disabled plugins still accept signed late payment confirmations; forged ones fail.
  request('/stripe/webhook',{},status=400)
  paid=json.loads(json.dumps(pending));paid['id']='evt_plugin_paid';paid['type']='checkout.session.async_payment_succeeded';paid['data']['object']['payment_status']='paid'
  bad=json.loads(json.dumps(paid));bad['data']['object']['metadata']['tenant']='other-business';send(bad,status=400)
  bad=json.loads(json.dumps(paid));bad['data']['object']['amount_total']+=1;send(bad,status=409)
  before=request('/realtime/access',{'scope':'tracking','orderId':order},tracking=tracking)['revision']
  send(paid,'/stripe/webhook');send(paid)
  check(request('/realtime/access',{'scope':'tracking','orderId':order},tracking=tracking)['revision']!=before)
  check(request('/tracking/'+order,tracking=tracking)['paymentStatus']=='paid')
  check(db.execute("SELECT count(*) FROM payments WHERE order_id=? AND kind='capture'",(order,)).fetchone()[0]==1)
  refund={'id':'evt_plugin_refund','type':'charge.refunded','livemode':False,'data':{'object':{'payment_intent':'pi_plugin','currency':receipt['currency'].lower(),'amount':receipt['total'],'amount_refunded':receipt['total']}}}
  send(refund)
  check(request('/tracking/'+order,tracking=tracking)['paymentStatus']=='refunded')
  reports=request('/manager/reports',token=admin);check(reports['netCollected']==0 and reports['refunded']==receipt['total'])
  toggle(True)
  check(request('/manager/plugins/stripe/settings',token=admin)==saved)
  # Broken credentials cannot silently produce a manual payment order.
  (work/'stripe.json').write_text('{broken')
  body['idempotencyKey']=str(uuid.uuid4());request('/orders',body,status=503)
  (work/'stripe.json').write_bytes(encrypted)
  db.close()
  print(f'Stripe plugin HTTP: {checks} checks passed.')
 finally:
  server.terminate();server.wait(timeout=5)
