import csv,io,json,zipfile
cities=set()
with zipfile.ZipFile('/srv/dyws-nominatim/data/nar-202606.zip') as z:
 for name in z.namelist():
  if not name.startswith('Addresses/Address_') or not name.endswith('.csv'):continue
  with z.open(name) as f:
   for r in csv.DictReader(io.TextIOWrapper(f,encoding='utf-8-sig')):
    for k in ['CSD_ENG_NAME','CSD_FRE_NAME','MAIL_MUN_NAME']:
     city=r.get(k,'').strip()
     if city:cities.add(city)
with open('/srv/dyws-nominatim/data/canadian-cities.json','w') as f:json.dump({'source':'Statistics Canada National Address Register, June 2026','cities':sorted(cities,key=lambda s:(-len(s),s))},f,ensure_ascii=False)
print('Cached Canadian municipality and mailing locality names:',len(cities))
