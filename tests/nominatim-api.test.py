"""HTTP auth, optional lifecycle, validation and manual checkout without a geocoder."""
import json,os,pathlib,socket,subprocess,tempfile,time,urllib.request,urllib.error,urllib.parse,uuid
root=pathlib.Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='dyws-address-http-') as temp:
 work=pathlib.Path(temp)
 subprocess.run(['php',str(root/'server/setup.php'),temp],check=True,capture_output=True)
 password=next(x.split(': ',1)[1] for x in (work/'LOCAL-ACCESS.txt').read_text().splitlines() if x.startswith('Manager password:'))
 with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
 server=subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t',str(root/'public_html'),str(root/'server/router.php')],env={**os.environ,'DYWS_CONFIG':str(work/'config.json')},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 checks=0
 def request(route,body=None,token=None,status=200):
  global checks
  headers={'Content-Type':'application/json'}
  if token:headers['Authorization']='Bearer '+token
  req=urllib.request.Request(f'http://127.0.0.1:{port}/api/?route='+urllib.parse.quote(route,safe='/'),headers=headers,data=None if body is None else json.dumps(body).encode())
  try:response=urllib.request.urlopen(req,timeout=5)
  except urllib.error.HTTPError as e:response=e
  with response:data=json.load(response);assert response.status==status,(route,response.status,data)
  checks+=1;return data
 try:
  for _ in range(50):
   try:request('/health');break
   except OSError:time.sleep(.05)
  request('/plugins/nominatim/config',status=404)
  token=request('/login',{'role':'manager','password':password})['token']
  state=request('/manager/plugins',token=token)
  state=request('/manager/plugins',{'id':'nominatim','active':True,'revision':state['revision']},token)
  assert request('/plugins/nominatim/config')['enabled'] is False
  request('/manager/plugins/nominatim/settings',status=401)
  request('/manager/plugins/nominatim/settings',{'enabled':True},status=401)
  settings=request('/manager/plugins/nominatim/settings',token=token)
  request('/manager/plugins/nominatim/settings',{'enabled':True,'revision':settings['revision']},token,status=422)
  request('/plugins/nominatim/search',{'query':'abc'},status=422)
  request('/plugins/nominatim/search',{'query':'Edmonton'},status=503)
  request('/plugins/nominatim/search',{'query':'a'*2000},status=413)
  # Optional lookup failure cannot block an ordinary manually entered order.
  receipt=request('/orders',{'idempotencyKey':str(uuid.uuid4()),'customer':{'name':'Fictional Guest','phone':'7805550142'},'fulfillment':'delivery','addressDetails':{'line1':'123 Example Avenue NW','city':'Edmonton','region':'AB','country':'Canada'},'lines':[{'id':'breakfast0','quantity':1}],'demoAcknowledged':True},status=201)
  assert receipt['id']
  request('/manager/plugins',{'id':'nominatim','active':False,'revision':state['revision']},token)
  request('/plugins/nominatim/config',status=404)
  request('/plugins/nominatim/search',{'query':'Edmonton'},status=404)
  assert request('/catalog')['categories']
  print(f'Nominatim HTTP: {checks} checks passed.')
 finally:server.terminate();server.wait(timeout=5)
