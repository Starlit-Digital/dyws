#!/usr/bin/env python3
"""Verify a deployed geocoder without logging credentials or private addresses."""
import argparse
import base64
import json
import statistics
import time
import urllib.error
import urllib.parse
import urllib.request

parser = argparse.ArgumentParser()
parser.add_argument('--credentials', required=True, help='Private clients.json path, outside web roots')
parser.add_argument('--client', default='verification')
parser.add_argument('--base-url', default='https://geo.sltd.ca')
args = parser.parse_args()
with open(args.credentials) as handle:
    client = json.load(handle)[args.client]
authorization = 'Basic '+base64.b64encode((client['username']+':'+client['password']).encode()).decode()

def request(path, expected=200, auth=authorization, method='GET'):
    headers = {'User-Agent': 'DYWS-geocoder-verification/1.0'}
    if auth:
        headers['Authorization'] = auth
    start = time.monotonic()
    req = urllib.request.Request(args.base_url+path, headers=headers, method=method)
    try:
        response = urllib.request.urlopen(req, timeout=20)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        body = response.read(1048576)
        assert response.status == expected, 'Unexpected HTTP status: '+str(response.status)
        elapsed = (time.monotonic()-start)*1000
    time.sleep(.4)
    return body, elapsed

request('/status?format=json', 401, auth=None)
request('/status?format=json', 401, auth='Basic '+base64.b64encode(b'verification:wrong').decode())
request('/reverse?lat=53.54&lon=-113.49', 404)
request('/details', 404)
request('/search', 403, method='POST')
status = json.loads(request('/status?format=json')[0])
assert status['status'] == 0, 'Nominatim is not ready'
timings = []
counts = []
# Public civic locations, never customer records or driver positions.
cases = [
    ('Edmonton, Alberta', {'city': 'Edmonton'}),
    ('Edmonton City Hall', {'house_number': '1', 'road': '103A Avenue NW'}),
    ('Calgary City Hall', {'house_number': '716', 'city': 'Calgary'}),
    ('Jasp, Edmonton', {'road': 'Jasper Avenue NW', 'city': 'Edmonton'}),
    ('Jasp, Edm', {'road': 'Jasper Avenue NW', 'city': 'Edmonton'}),
    ('Edmotnon City Hall', {'house_number': '1', 'road': '103A Avenue NW'}),
    ('Edmonton City Hal', {'house_number': '1', 'road': '103A Avenue NW'}),
    ('Calg City Hall', {'house_number': '716', 'city': 'Calgary'}),
    ('1 103A Aven NW, Edm', {'house_number': '1', 'road': '103A Avenue NW'}),
    ('16767 91 Street NW, Edmonton', None),
    ('zzqvxxzz', {}),
]
for query, expected in cases:
    params = urllib.parse.urlencode({'q': query, 'format': 'jsonv2', 'addressdetails': 1, 'countrycodes': 'ca', 'limit': 5})
    body, elapsed = request('/search?'+params)
    matches = json.loads(body)
    assert isinstance(matches, list) and len(matches) <= 5
    for match in matches:
        assert match['address']['country_code'] == 'ca'
        assert -180 <= float(match['lon']) <= 180 and -90 <= float(match['lat']) <= 90
    if expected:
        assert matches and all(matches[0]['address'].get(k) == v for k,v in expected.items()), 'Incorrect match: '+query
    elif expected is None:
        assert all(m['address'].get('house_number') == '16767' for m in matches), 'Different house number was suggested'
    else:
        assert matches == [], 'Unmatched input returned an unrelated place'
    counts.append({'query': query, 'matches': len(matches), 'milliseconds': round(elapsed, 1)})
    timings.append(elapsed)
print(json.dumps({'endpoint': args.base_url, 'status': status, 'checks': 'authentication, method, route scope, exact civic results, prefix and typo matches, house number preservation and TLS passed',
                  'queries': counts, 'medianMilliseconds': round(statistics.median(timings), 1),
                  'maxMilliseconds': round(max(timings), 1)}, indent=2))
