"""Business capabilities must be optional at the API and order transaction boundaries."""
import json,os,pathlib,shutil,socket,subprocess,tempfile,time,urllib.request,urllib.error,uuid
root=pathlib.Path(__file__).resolve().parents[1];checks=0
with tempfile.TemporaryDirectory(prefix='dyws-business-plugins-') as temp:
 work=pathlib.Path(temp);subprocess.run(['php',str(root/'server/setup.php'),str(work)],check=True,capture_output=True)
 config=json.loads((work/'config.json').read_text());config['plugins_path']=str(work/'plugins');(work/'config.json').write_text(json.dumps(config));shutil.copytree(root/'plugins',work/'plugins')
 access=(work/'LOCAL-ACCESS.txt').read_text().splitlines();password=next(x.split(': ',1)[1]for x in access if x.startswith('Manager password:'))
 with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
 proc=subprocess.Popen(['php','-d','opcache.enable=0','-S',f'127.0.0.1:{port}','-t',str(root/'public_html'),str(root/'server/router.php')],env={**os.environ,'DYWS_CONFIG':str(work/'config.json')},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 def check(v):
  global checks
  assert v;checks+=1
 def req(route,body=None,token=None,status=200,headers=None):
  global checks
  h={'Content-Type':'application/json',**(headers or {})}
  if token:h['Authorization']='Bearer '+token
  request=urllib.request.Request(f'http://127.0.0.1:{port}/api/?route='+route,headers=h,data=None if body is None else json.dumps(body).encode())
  try:
   with urllib.request.urlopen(request,timeout=8) as r:code=r.status;data=json.load(r)
  except urllib.error.HTTPError as e:code=e.code;data=json.load(e)
  assert code==status,(route,code,data);checks+=1;return data
 def activate(id,active):
  state=req('/manager/plugins',token=admin)
  return req('/manager/plugins',{'id':id,'active':active,'revision':state['revision']},admin)
 def order(mode='pickup'):
  return {'idempotencyKey':str(uuid.uuid4()),'customer':{'name':'Fictional Guest','phone':'7805550142'},'fulfillment':mode,'address':'123 Example Street' if mode=='delivery' else '', 'lines':[{'id':'breakfast0','quantity':1}],'demoAcknowledged':True}
 try:
  for _ in range(50):
   try:req('/health');break
   except OSError:time.sleep(.1)
  admin=req('/login',{'role':'manager','password':password})['token']
  check(set(req('/catalog')['fulfillmentModes'])=={'pickup','delivery'})
  receipt=req('/orders',order(),status=201)
  activate('pickup',False);check(req('/catalog')['fulfillmentModes']==['delivery'])
  req('/pickup/availability',{'date':'2030-01-01'},status=404);req('/orders',order(),status=409)
  check(req('/tracking/'+receipt['id'],headers={'X-Tracking-Token':receipt['trackingToken']})['id']==receipt['id'])
  activate('delivery',False);check(req('/catalog')['fulfillmentModes']==[])
  req('/orders',order('delivery'),status=409);req('/manager/runs',{},admin,status=404)
  activate('pickup',True);req('/orders',order(),status=201)
  activate('catalog',False);req('/catalog',status=404);req('/manager/catalog',token=admin,status=404);req('/orders',order(),status=409)
  check(req('/tracking/'+receipt['id'],headers={'X-Tracking-Token':receipt['trackingToken']})['id']==receipt['id'])
  activate('catalog',True)
  # Installed active but broken implementation fails closed, rather than becoming core ordering.
  entry=work/'plugins/pickup/plugin.php';before=entry.read_text();entry.write_text('<?php throw new RuntimeException("Broken fixture");')
  req('/orders',order(),status=503);req('/health');entry.write_text(before)
  activate('booking',True)
  req('/manager/plugins/booking/settings',status=401);req('/manager/plugins/booking/appointments',status=401)
  settings=req('/manager/plugins/booking/settings',token=admin)
  desired={'timeZone':'America/Edmonton','services':[{'id':'cut','name':'Haircut','duration':45},{'id':'beard','name':'Beard shape','duration':30}],'days':[1,2,3,4,5,6,7]}
  req('/manager/plugins/booking/settings',{'revision':settings['revision'],'settings':desired},admin)
  import datetime
  date=(datetime.date.today()+datetime.timedelta(days=2)).isoformat()
  slots=req('/plugins/booking/availability',{'serviceId':'cut','date':date})['slots'];check(bool(slots))
  booking={'serviceId':'cut','startsAt':slots[0]['startsAt'],'customer':{'name':'Fictional Appointment','phone':'7805550142'},'acknowledged':True,'idempotencyKey':str(uuid.uuid4())}
  reserved=req('/plugins/booking/reserve',booking);check(req('/plugins/booking/reserve',booking)==reserved)
  req('/plugins/booking/reserve',{**booking,'serviceId':'beard','idempotencyKey':str(uuid.uuid4())},status=409)
  req('/plugins/booking/cancel',{'id':reserved['id'],'token':'wrong'},status=404)
  req('/manager/plugins/booking/appointments',{'id':reserved['id'],'status':'completed'},admin,status=409)
  # Retrying an accepted request remains valid after service settings change.
  settings=req('/manager/plugins/booking/settings',token=admin);req('/manager/plugins/booking/settings',{'revision':settings['revision'],'settings':{**desired,'services':[]}},admin)
  check(req('/plugins/booking/reserve',booking)==reserved)
  activate('booking',False);req('/plugins/booking/services',status=404);activate('booking',True)
  check(len(req('/manager/plugins/booking/appointments',token=admin)['appointments'])==1)
  req('/plugins/booking/cancel',{'id':reserved['id'],'token':reserved['cancellationToken']})
  req('/plugins/booking/cancel',{'id':reserved['id'],'token':reserved['cancellationToken']})
  # Two independent PHP processes compete for the same shared resource and interval.
  settings=req('/manager/plugins/booking/settings',token=admin);req('/manager/plugins/booking/settings',{'revision':settings['revision'],'settings':desired},admin)
  concurrent={**booking,'startsAt':slots[-1]['startsAt'],'idempotencyKey':str(uuid.uuid4())}
  helper=work/'race.php'
  helper.write_text("<?php require "+repr(str(root/'server/bootstrap.php'))+"; require_once "+repr(str(root/'plugins/booking/Booking.php'))+"; [$config,$store]=dyws_bootstrap($argv[1]); try{$b=new \\dyws\\Plugins\\Booking\\Booking($config,$store);$b->reserve(json_decode($argv[2],true,32,JSON_THROW_ON_ERROR));echo '200';}catch(\\dyws\\ApiError $e){echo $e->http;}")
  first=subprocess.Popen(['php',str(helper),str(work/'config.json'),json.dumps(concurrent)],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
  second=subprocess.Popen(['php',str(helper),str(work/'config.json'),json.dumps({**concurrent,'idempotencyKey':str(uuid.uuid4())})],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
  results=[p.communicate(timeout=10) for p in [first,second]]
  check(sorted(out.decode() for out,err in results)==['200','409'])
  # Booking only hosts can browse historical orders without a catalog file.
  activate('catalog',False);catalog_path=config.pop('catalog');(work/'config.json').write_text(json.dumps(config))
  req('/deals',status=409);req('/manager/deals',token=admin,status=409)
  req('/manager/lookup&q=Fictional',token=admin)
  state=req('/manager/plugins',token=admin);req('/manager/plugins',{'id':'catalog','active':True,'revision':state['revision']},admin,status=409)
  config['catalog']=catalog_path;(work/'config.json').write_text(json.dumps(config));activate('catalog',True)
  # A host with no optional plugin files can still boot and read historical receipts.
  shutil.rmtree(work/'plugins');(work/'plugins').mkdir();(work/'plugins/bundled.json').write_text('{"active":[]}')
  req('/health');check(req('/plugins')['plugins']==[])
  check(req('/tracking/'+receipt['id'],headers={'X-Tracking-Token':receipt['trackingToken']})['id']==receipt['id'])
  req('/orders',order(),status=503)
  print(f'Business plugins and booking HTTP: {checks} checks passed.')
 finally:proc.terminate();proc.wait(timeout=5)
