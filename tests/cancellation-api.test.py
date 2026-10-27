"""Customer capability, location settings, deadlines and ledger behavior over HTTP."""
import json,os,pathlib,socket,subprocess,tempfile,time,urllib.request,urllib.error,urllib.parse,uuid,sqlite3
root=pathlib.Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='dyws-cancel-api-') as temp:
 work=pathlib.Path(temp);subprocess.run(['php',str(root/'server/setup.php'),str(work)],check=True,capture_output=True)
 config=json.loads((work/'config.json').read_text());access=(work/'LOCAL-ACCESS.txt').read_text().splitlines()
 password=lambda key:next(x.split(': ',1)[1] for x in access if x.startswith(key+':'))
 with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
 proc=subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t',str(root/'public_html'),str(root/'server/router.php')],env={**os.environ,'DYWS_CONFIG':str(work/'config.json')},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 checks=0
 def req(route,body=None,token=None,tracking=None,status=200):
  global checks
  headers={'Content-Type':'application/json'}
  if token:headers['Authorization']='Bearer '+token
  if tracking:headers['X-Tracking-Token']=tracking
  request=urllib.request.Request(f'http://127.0.0.1:{port}/api/?route='+urllib.parse.quote(route,safe='/'),headers=headers,data=None if body is None else json.dumps(body).encode())
  try:
   with urllib.request.urlopen(request,timeout=5) as response:code=response.status;data=json.load(response)
  except urllib.error.HTTPError as e:code=e.code;data=json.load(e)
  assert code==status,(route,code,data);checks+=1;return data
 def check(ok):
  global checks
  assert ok;checks+=1
 def place(location='north'):
  return req('/orders',{'idempotencyKey':str(uuid.uuid4()),'demoAcknowledged':True,'customer':{'name':'Fictional Guest','phone':'7805550100'},'fulfillment':'pickup','locationId':location,'tip':1100,'lines':[{'id':'breakfast0','variant':'','quantity':1}]},status=201)
 try:
  for _ in range(50):
   try:req('/health');break
   except OSError:time.sleep(.1)
  admin=req('/login',{'role':'manager','password':password('Manager password')})['token']
  driver=req('/login',{'role':'driver','driverId':'demo-driver','password':password('Driver password')})['token']
  data=req('/manager/catalog',token=admin);data['catalog']['locations']=[{'id':'north','name':'North','address':'123 Example Street','active':True,'customerCancellation':{'enabled':True,'minutes':6}},{'id':'west','name':'West','address':'456 Example Street','active':True,'customerCancellation':{'enabled':False,'minutes':4}}]
  req('/manager/catalog',data,status=401);req('/manager/catalog',data,token=driver,status=403)
  saved=req('/manager/catalog',data,token=admin);check(req('/catalog')['locations'][0]['customerCancellation']=={'enabled':True,'minutes':6})
  bad=json.loads(json.dumps(saved));bad['catalog']['locations'][0]['customerCancellation']['minutes']=1.5;req('/manager/catalog',bad,token=admin,status=422)
  order=place();id=order['id'];token=order['trackingToken'];path='/tracking/'+id
  req(path+'/cancel',{},status=404);req(path+'/cancel',{},token=admin,status=404);req(path+'/cancel',{},tracking='bad',status=404)
  state=req(path,tracking=token);check(state['cancellation']['available'] and state['cancellation']['fee']==0 and state['cancellation']['refundAmount']==order['total'])
  req('/manager/orders/'+id+'/payment',{'kind':'capture'},token=admin)
  result=req(path+'/cancel',{},tracking=token);check(result['status']=='cancelled' and result['paymentStatus']=='refunded')
  req(path+'/cancel',{},tracking=token);check(req(path,tracking=token)['cancellation']['paymentState']=='refunded')
  orders=req('/manager/orders',token=admin);row=next(o for o in orders['orders'] if o['id']==id);check(row['cancellation']['cancelledAt'] is not None and row['tip']==1100)
  with sqlite3.connect(config['database']) as db:
   check(db.execute("select count(*) from payments where order_id=? and kind='refund'",(id,)).fetchone()[0]==1)
   check(db.execute("select amount from payments where order_id=? and kind='refund'",(id,)).fetchone()[0]==order['total'])
  disabled=place('west');req('/tracking/'+disabled['id']+'/cancel',{},tracking=disabled['trackingToken'],status=409)
  expired=place();
  with sqlite3.connect(config['database']) as db:db.execute('update orders set created_at=? where id=?',(int(time.time())-360,expired['id']))
  req('/tracking/'+expired['id']+'/cancel',{},tracking=expired['trackingToken'],status=409)
  check(not req('/tracking/'+expired['id'],tracking=expired['trackingToken'])['cancellation']['available'])
  print(f'Customer cancellation HTTP: {checks} checks passed.')
 finally:proc.terminate();proc.wait(timeout=5)
