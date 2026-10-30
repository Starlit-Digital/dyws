"""Exercise scoped machine credentials, discovery, exports and revocation over HTTP."""
import json,os,pathlib,shutil,socket,subprocess,tempfile,time,urllib.request,urllib.error,urllib.parse
root=pathlib.Path(__file__).resolve().parents[1]
if not shutil.which('php-cgi'):raise RuntimeError('Integration API tests require php-cgi on PATH to verify real QUERY input handling.')
with tempfile.TemporaryDirectory(prefix='dyws-report-api-') as temp:
 work=pathlib.Path(temp);subprocess.run(['php',str(root/'server/setup.php'),str(work)],check=True,capture_output=True)
 config=json.loads((work/'config.json').read_text());config['plugins_path']=str(work/'plugins');(work/'config.json').write_text(json.dumps(config));shutil.copytree(root/'plugins',work/'plugins')
 access=(work/'LOCAL-ACCESS.txt').read_text().splitlines();password=lambda key:next(x.split(': ',1)[1]for x in access if x.startswith(key+':'))
 with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
 proc=subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t',str(root/'public_html'),str(root/'server/router.php')],env={**os.environ,'DYWS_CONFIG':str(work/'config.json')},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 checks=0
 def request(route,body=None,token=None,status=200,query='',method=None,content_type='application/json',raw=None):
  global checks
  headers={'Content-Type':content_type}
  if token:headers['Authorization']='Bearer '+token
  payload=raw if raw is not None else (None if body is None else json.dumps(body).encode())
  # PHP's development HTTP server rejects QUERY before dispatch. CGI exercises the
  # actual public entrypoint, REQUEST_METHOD and php://input without rewriting the verb.
  if method=='QUERY':
   env={**os.environ,'DYWS_CONFIG':str(work/'config.json'),'REDIRECT_STATUS':'1','GATEWAY_INTERFACE':'CGI/1.1','SERVER_PROTOCOL':'HTTP/1.1','SERVER_NAME':'localhost','SERVER_PORT':str(port),'REMOTE_ADDR':'127.0.0.2','SCRIPT_FILENAME':str(root/'public_html/api/endpoint.php'),'SCRIPT_NAME':'/api/endpoint.php','REQUEST_METHOD':'QUERY','QUERY_STRING':'route='+urllib.parse.quote(route,safe='/')+query,'CONTENT_TYPE':content_type,'CONTENT_LENGTH':str(len(payload or b''))}
   if token:env['HTTP_AUTHORIZATION']='Bearer '+token
   result=subprocess.run(['php-cgi'],input=payload or b'',env=env,capture_output=True,check=True,timeout=10)
   head,content=result.stdout.split(b'\r\n\r\n',1)
   fields=dict(line.decode().split(': ',1)for line in head.split(b'\r\n')if b': 'in line)
   code=int(fields.get('Status','200').split()[0]);data=json.loads(content)
   assert code==status,(route,code,data);checks+=1
   check(fields.get('Cache-Control')=='no-store')
   return data
  req=urllib.request.Request(f'http://127.0.0.1:{port}/api/?route='+urllib.parse.quote(route,safe='/')+query,headers=headers,data=payload,method=method)
  try:
   with urllib.request.urlopen(req,timeout=5) as r:code=r.status;data=json.load(r)
  except urllib.error.HTTPError as e:code=e.code;data=json.load(e)
  assert code==status,(route,code,data);checks+=1;return data
 def check(v):
  global checks
  assert v;checks+=1
 try:
  for _ in range(50):
   try:request('/health');break
   except OSError:time.sleep(.1)
  admin=request('/login',{'role':'manager','password':password('Manager password')})['token'];driver=request('/login',{'role':'driver','driverId':'demo-driver','password':password('Driver password')})['token']
  import base64, datetime, sqlite3, uuid
  # Real fictional order data verifies the aggregate and tenant boundary, not just empty responses.
  receipt=request('/orders',{'idempotencyKey':str(uuid.uuid4()),'customer':{'name':'Fictional API Guest','phone':'7805550142'},'lines':[{'id':'breakfast0','variant':'','quantity':1}],'demoAcknowledged':True},status=201)
  with sqlite3.connect(config['database']) as db:
   db.row_factory=sqlite3.Row
   stamp=int(datetime.datetime(2026,10,3,12,tzinfo=datetime.timezone.utc).timestamp())
   db.execute('UPDATE orders SET created_at=? WHERE id=?',(stamp,receipt['id']))
   row=dict(db.execute('SELECT * FROM orders WHERE id=?',(receipt['id'],)).fetchone())
   row.update(id='OT-FFFFFFFFFFFF',tenant='other-tenant',total=999999)
   db.execute('INSERT INTO orders ('+','.join(row)+') VALUES ('+','.join('?' for _ in row)+')',list(row.values()))
  def command(key, name, body=None, status=200):
   return request('/integrations/v1/commands/'+name+'/execute', {} if body is None else body, token=key, status=status)
  request('/manager/api-keys', status=401)
  request('/manager/api-keys', token=driver, status=403)
  request('/integrations/v1/commands', token=admin, status=401)
  rootkey=request('/manager/api-keys', {'name':'Owner provisioning','scopes':['keys:manage','reports:read','reports:export']}, token=admin)
  key=rootkey['secret']; keyid=rootkey['key']['id']
  check(key.startswith('dyws_') and len(key)==69)
  listing=request('/manager/api-keys', token=admin)
  check('secret' not in json.dumps(listing) and key not in json.dumps(listing))
  commands=request('/integrations/v1/commands', token=key)['commands']
  check(len(commands)==5)
  detail=request('/integrations/v1/commands/keys.create', token=key)
  check(detail['inputSchema']['additionalProperties'] is False)
  child=command(key,'keys.create',{'name':'AI reporting','scopes':['reports:read','reports:export']})
  service=child['secret']; childid=child['key']['id']
  check(len(request('/integrations/v1/commands', token=service)['commands'])==2)
  command(service,'keys.create',{'name':'Escalate','scopes':['reports:read']},status=403)
  command(key,'keys.create',{'name':'Escalate','scopes':['keys:manage']},status=403)
  command(key,'keys.create',{'name':'Long expiry','scopes':['reports:read'],'expiresAt':rootkey['key']['expiresAt']+1},status=422)
  command(key,'keys.create',{'name':'Unknown scope','scopes':['orders:write']},status=403)
  command(service,'reports.summary',{'from':'2026-02-30'},status=422)
  command(service,'reports.summary',{'from':'2024-01-01','to':'2026-01-01'},status=422)
  command(service,'reports.summary',{'tenant':'other'},status=422)
  data=command(service,'reports.summary',{'from':'2026-10-01','to':'2026-10-07'})
  check(data['range']=={'from':'2026-10-01','to':'2026-10-07'} and data['moneyUnit']=='cents')
  check(data['report']['orderCount']==1 and data['report']['orderedValue']==receipt['total'])
  summary_route='/integrations/v1/commands/reports.summary/execute'
  filters={'from':'2026-10-01','to':'2026-10-07'}
  summary_definition=request('/integrations/v1/commands/reports.summary',token=service)
  check(summary_definition['method']=='POST' and summary_definition['transport']['preferredMethod']=='QUERY')
  check('transport' not in request('/integrations/v1/commands/reports.export',token=service))
  check(request(summary_route,filters,token=service,method='QUERY')==data)
  # The reusable client also runs against this real HTTP endpoint. The installed
  # PHP development server rejects QUERY, so its POST fallback must return parity.
  client_script="""
import {createIntegrationReportClient} from './public_html/dyws/integration-reports.js';
const events=[];
const client=createIntegrationReportClient(process.env.TEST_API,{token:process.env.TEST_KEY,onMetric:event=>events.push(event)});
const first=await client.summary({from:'2026-10-01',to:'2026-10-07'});
const second=await client.summary({from:'2026-10-01',to:'2026-10-07'});
console.log(JSON.stringify({first,second,events}));
"""
  client_result=subprocess.run(['node','--input-type=module','-e',client_script],cwd=root,env={**os.environ,'TEST_API':f'http://127.0.0.1:{port}/api/','TEST_KEY':service},capture_output=True,text=True,check=True,timeout=15)
  observed=json.loads(client_result.stdout)
  check(observed['first']==data and observed['second']==data)
  attempts=[e for e in observed['events']if e['event']=='attempt']
  check(attempts[-1]['method']=='POST' or all(e['method']=='QUERY' for e in attempts))
  check(all(e['status']==200 for e in observed['events']if e['event']=='result'))
  check(service not in client_result.stdout)
  cli=subprocess.run(['node','scripts/report-summary.mjs','2026-10-01','2026-10-07'],cwd=root,env={**os.environ,'DYWS_API_URL':f'http://127.0.0.1:{port}/api/','DYWS_REPORT_KEY':service,'DYWS_REPORT_METRICS':'1','DYWS_REPORT_FORCE_POST':'0'},capture_output=True,text=True,check=True,timeout=15)
  check(json.loads(cli.stdout)==data)
  check(json.loads(cli.stderr.splitlines()[-1])['ok'] is True and service not in cli.stderr)
  check(request(summary_route,{'from':'2026-10-05','to':'2026-10-07'},token=service,method='QUERY')['report']['orderCount']==0)
  request(summary_route,{},method='QUERY',status=401)
  request(summary_route,{'tenant':'other'},token=service,method='QUERY',status=422)
  request(summary_route,{'from':'2026-02-30'},token=service,method='QUERY',status=422)
  request(summary_route,token=service,method='QUERY',raw=b'{',status=400)
  request(summary_route,{},token=service,method='QUERY',content_type='text/plain',status=415)
  request(summary_route,token=service,method='QUERY',raw=b' '*32769,status=413)
  # QUERY uses the same per key persistent rate limit, not a separate quota.
  import hashlib,hmac
  window=int(time.time())//60
  buckets=[hmac.new(config['tracking_secret'].encode(),f'integration-key:{childid}|127.0.0.2|{value}'.encode(),hashlib.sha256).hexdigest()for value in [window,window+1]]
  with sqlite3.connect(config['database']) as db:
   for bucket in buckets:db.execute('INSERT INTO limits(bucket,hits,expires_at) VALUES(?,120,?) ON CONFLICT(bucket) DO UPDATE SET hits=120',(bucket,int(time.time())+120))
  request(summary_route,filters,token=service,method='QUERY',status=429)
  with sqlite3.connect(config['database']) as db:
   for bucket in buckets:db.execute('DELETE FROM limits WHERE bucket=?',(bucket,))
  for forbidden in ['keys.create','keys.revoke','reports.export']:
   request('/integrations/v1/commands/'+forbidden+'/execute',{},token=key,method='QUERY',status=404)
  request('/orders',{},token=service,method='QUERY',status=404)
  config['integration_query_enabled']=False;(work/'config.json').write_text(json.dumps(config))
  check(request('/integrations/v1/commands/reports.summary',token=service)['transport']['preferredMethod']=='POST')
  request(summary_route,filters,token=service,method='QUERY',status=405)
  check(command(service,'reports.summary',filters)==data)
  config['integration_query_enabled']=True;(work/'config.json').write_text(json.dumps(config))
  export_only=request('/manager/api-keys',{'name':'Export only','scopes':['reports:export']},token=admin)
  request(summary_route,filters,token=export_only['secret'],method='QUERY',status=403)
  check('Fictional API Guest' not in json.dumps(data) and '7805550142' not in json.dumps(data))
  for format in ['json','csv']:
   export=command(service,'reports.export',{'from':'2026-10-01','to':'2026-10-07','format':format})
   decoded=base64.b64decode(export['content']).decode()
   check(export['filename'].endswith('.'+format) and len(decoded)>30)
   if format=='json': check(json.loads(decoded)==data)
  command(service,'reports.export',{'format':'pdf'},status=422)
  request('/manager/reports',token=service,status=401)
  read=command(key,'keys.create',{'name':'Read only','scopes':['reports:read']})
  command(read['secret'],'reports.export',{},status=403)
  request(summary_route,filters,token=admin,method='QUERY',status=401)
  other=request('/manager/api-keys',{'name':'Other owner','scopes':['keys:manage','reports:read']},token=admin)
  command(other['secret'],'keys.revoke',{'keyId':childid},status=404)
  check(len(command(key,'keys.list')['keys'])==2)
  command(key,'keys.list',{'offset':-1},status=422)
  check(command(key,'keys.list',{'offset':100})['keys']==[])
  command(key,'keys.revoke',{'keyId':childid})
  request('/integrations/v1/commands', token=service,status=401)
  request(summary_route,filters,token=service,method='QUERY',status=401)
  request('/manager/api-keys/'+keyid+'/revoke',{},token=admin)
  request('/integrations/v1/commands',token=read['secret'],status=401)
  request('/integrations/v1/commands',token=key,status=401)
  # A second tenant sharing this SQLite database cannot use or list the first tenant's keys.
  original_tenant=config['tenant'];config['tenant']='other-tenant';(work/'config.json').write_text(json.dumps(config))
  request('/integrations/v1/commands',token=other['secret'],status=401)
  request(summary_route,filters,token=other['secret'],method='QUERY',status=401)
  config['tenant']=original_tenant;(work/'config.json').write_text(json.dumps(config))
  # Use the actual installed tenant value for direct expiry and persistence checks.
  with sqlite3.connect(config['database']) as db:
   rows=db.execute('SELECT token_hash FROM integration_keys').fetchall()
   check(all(key not in row[0] and service not in row[0] for row in rows))
   check(db.execute('SELECT count(*) FROM integration_audit').fetchone()[0]>5)
   db.execute('UPDATE integration_keys SET expires_at=0 WHERE id=?',(other['key']['id'],))
  request('/integrations/v1/commands',token=other['secret'],status=401)
  request(summary_route,filters,token=other['secret'],method='QUERY',status=401)
  print(f'Integration API: {checks} checks passed.')
 finally:proc.terminate();proc.wait()
