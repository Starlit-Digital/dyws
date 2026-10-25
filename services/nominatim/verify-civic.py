#!/usr/bin/env python3
"""Live civic address checks with public civic fixtures and source attribution."""
import argparse,base64,json,time,urllib.parse,urllib.request,statistics
p=argparse.ArgumentParser();p.add_argument('--credentials',required=True);p.add_argument('--client',default='verification');p.add_argument('--base-url',default='https://geo.sltd.ca');a=p.parse_args()
with open(a.credentials) as f:c=json.load(f)[a.client]
header='Basic '+base64.b64encode((c['username']+':'+c['password']).encode()).decode()
report=[]
for query,house,city in [('716 101 ave sw, Calgary','716','Calgary'),('999999999 132a ave',None,None)]:
 url=a.base_url+'/search?'+urllib.parse.urlencode({'q':query,'format':'jsonv2','addressdetails':1,'countrycodes':'ca','limit':5})
 start=time.monotonic()
 with urllib.request.urlopen(urllib.request.Request(url,headers={'Authorization':header}),timeout=15) as r:rows=json.load(r)
 ms=round((time.monotonic()-start)*1000,1)
 if house:
  assert rows and rows[0]['address']['house_number']==house and rows[0]['address']['city'].lower()==city.lower(),query
  assert rows[0]['source']=='Statistics Canada National Address Register'
  assert 'does not constitute an endorsement' in rows[0]['licence']
 else:assert rows==[]
 report.append({'query':query,'matches':len(rows),'milliseconds':ms});time.sleep(.4)
print(json.dumps({'checks':'civic matching, source, acknowledgement and unknown number passed','queries':report,'medianMilliseconds':statistics.median(r['milliseconds'] for r in report)},indent=2))
