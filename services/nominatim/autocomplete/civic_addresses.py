"""Search the separately attributed public Statistics Canada address index."""
import re
import unicodedata

SOURCE='Adapted from Statistics Canada, National Address Register, June 2026. This does not constitute an endorsement by Statistics Canada of this product.'
ALIASES={'avenue':'ave','aven':'ave','av':'ave','street':'st','str':'st','road':'rd','drive':'dr','boulevard':'blvd','crescent':'cres','court':'ct','place':'pl','lane':'ln','trail':'trl','terrace':'terr','highway':'hwy','alberta':'ab','canada':'ca'}

def tokens(text):
    text=unicodedata.normalize('NFKD',text).encode('ascii','ignore').decode().lower()
    # A numeric street suffix is part of the identifier, not a separate word.
    text=re.sub(r'\b(\d+)\s+([a-z])\b',r'\1\2',text)
    return [ALIASES.get(w,w) for w in re.findall(r'[a-z0-9]+',text)]

async def search(db,query,limit=5):
    if len(query)>240:return []
    words=tokens(query)
    if len(words)<2 or len(words)>16 or not re.fullmatch(r'\d+[a-z]?',words[0]):return []
    house=words.pop(0)
    words=[w for w in words if w not in ('ab','ca')]
    if not words:return []
    # Numeric identifiers and compass directions always match exactly.
    expression=' & '.join("'%s'%s"%(w,'' if any(c.isdigit() for c in w) or w in ('nw','ne','sw','se','n','s','e','w') else ':*') for w in words)
    rows=await (await db.execute("""SELECT house,road,city,postal,latitude,longitude
        FROM dyws_civic.addresses WHERE house=%s AND terms @@ to_tsquery('simple',%s)
        ORDER BY city,road LIMIT %s""",(house,expression,limit))).fetchall()
    output=[]
    for house,road,city,postal,lat,lon in rows:
        address={'house_number':house,'road':road,'city':city,'state':'Alberta','ISO3166-2-lvl4':'CA-AB','country':'Canada','country_code':'ca'}
        if postal:address['postcode']=postal
        output.append({'lat':str(lat),'lon':str(lon),'display_name':', '.join(filter(None,[house+' '+road,city,'AB',postal,'Canada'])),'address':address,'source':'Statistics Canada National Address Register','licence':SOURCE})
    return output
