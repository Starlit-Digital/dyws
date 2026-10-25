"""Actual route lifecycle, manager and device auth, enrollment and order delivery."""
import json,os,pathlib,socket,subprocess,tempfile,time,urllib.request,urllib.error,urllib.parse,uuid
root=pathlib.Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='dyws-printer-http-') as temp:
 work=pathlib.Path(temp)
 subprocess.run(['php',str(root/'server/setup.php'),temp],check=True,capture_output=True)
 password=next(x.split(': ',1)[1] for x in (work/'LOCAL-ACCESS.txt').read_text().splitlines() if x.startswith('Manager password:'))
 with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
 server=subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t',str(root/'public_html'),str(root/'server/router.php')],env={**os.environ,'DYWS_CONFIG':str(work/'config.json')},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 checks=0
 def request(route,body=None,token=None,device=None,status=200):
  global checks
  headers={'Content-Type':'application/json'}
  if token:headers['Authorization']='Bearer '+token
  if device:headers['X-DYWS-Printer-Token']=device
  req=urllib.request.Request(f'http://127.0.0.1:{port}/api/?route='+urllib.parse.quote(route,safe='/'),headers=headers,data=None if body is None else json.dumps(body).encode())
  try:response=urllib.request.urlopen(req,timeout=5)
  except urllib.error.HTTPError as e:response=e
  with response:data=json.load(response);assert response.status==status,(route,response.status,data)
  checks+=1;return data
 try:
  for _ in range(50):
   try:request('/health');break
   except OSError:time.sleep(.05)
  public='/plugins/order-printer';manager='/manager/plugins/order-printer'
  request(public+'/poll',{},status=404)
  token=request('/login',{'role':'manager','password':password})['token']
  state=request('/manager/plugins',token=token)
  state=request('/manager/plugins',{'id':'order-printer','active':True,'revision':state['revision']},token)
  request(manager+'/settings',status=401);request(manager+'/devices',{'name':'Forged'},status=401)
  settings=request(manager+'/settings',token=token);location=settings['locations'][0]['id'] if settings['locations'] else ''
  pairing=request(manager+'/devices',{'name':'Fictional kitchen','locationId':location,'profile':'epson80'},token)
  request(public+'/poll',{},token=token,status=401) # A manager token is not a device token.
  device='d'*64;enrollment={'code':pairing['enrollmentCode'],'token':device,'deviceId':'http-device-001'}
  request(public+'/enroll',enrollment);request(public+'/enroll',enrollment)
  request(public+'/enroll',{**enrollment,'deviceId':'different-device'},status=409)
  request(public+'/poll',{'status':'ready'},device='e'*64,status=401)
  request(public+'/poll',{'status':'x'*3000},device=device,status=413)
  receipt=request('/orders',{'idempotencyKey':str(uuid.uuid4()),'customer':{'name':'Fictional Guest','phone':'7805550142'},'fulfillment':'pickup','locationId':location,'lines':[{'id':'breakfast0','quantity':1}],'demoAcknowledged':True},status=201)
  assert request(public+'/poll',{'status':'ready'},device=device)['job'] is None
  request('/manager/orders/'+receipt['id']+'/status',{'status':'accepted'},token)
  job=request(public+'/poll',{'status':'ready'},device=device)['job'];assert receipt['id'] in job['text']
  ack={'jobId':job['id'],'lease':job['lease'],'action':'start'}
  request(public+'/ack',ack,status=401);request(public+'/ack',ack,device=device)
  request(public+'/ack',{**ack,'action':'sent'},device=device)
  assert request(public+'/poll',{},device=device)['job'] is None
  state=request('/manager/plugins',{'id':'order-printer','active':False,'revision':state['revision']},token)
  request(public+'/poll',{},device=device,status=404);request(manager+'/settings',token=token,status=404)
  assert request('/catalog')['categories']
  request('/manager/plugins',{'id':'order-printer','active':True,'revision':state['revision']},token)
  assert request(public+'/poll',{},device=device)['job'] is None
  request(manager+'/manage',{'printerId':pairing['id'],'action':'revoke'},token)
  request(public+'/poll',{},device=device,status=401)
  print(f'Order printer HTTP: {checks} checks passed.')
 finally:server.terminate();server.wait(timeout=5)
