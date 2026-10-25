"""Bounded prefix and typo fallback around Nominatim's existing ASGI application.

Public civic addresses supplement native results; empty searches are expanded.
No query or result cache, no query
logging, no changes to house numbers, and no external network requests.
"""
import asyncio
import json
import math
import re
import unicodedata
from dataclasses import dataclass
from urllib.parse import parse_qsl, urlencode

DSN='dbname=dyws_nominatim host=/run/postgresql port=5433 connect_timeout=2 options=-cstatement_timeout=150'
MAX_CANDIDATES=3
MAX_SECONDS=2.0

def normalize(value):
    return unicodedata.normalize('NFKD',value).encode('ascii','ignore').decode().lower()

def distance(a,b):
    """Restricted Damerau Levenshtein distance, including adjacent transpositions."""
    matrix=[list(range(len(b)+1))]+[[i]+[0]*len(b) for i in range(1,len(a)+1)]
    for i in range(1,len(a)+1):
        for j in range(1,len(b)+1):
            matrix[i][j]=min(matrix[i-1][j]+1,matrix[i][j-1]+1,matrix[i-1][j-1]+(a[i-1]!=b[j-1]))
            if i>1 and j>1 and a[i-1]==b[j-2] and a[i-2]==b[j-1]:
                matrix[i][j]=min(matrix[i][j],matrix[i-2][j-2]+1)
    return matrix[-1][-1]

@dataclass(frozen=True)
class Candidate:
    query: str
    score: float
    house: str = ''
    street: str = ''
    changes: tuple = ()

class Dictionary:
    def __init__(self,db):
        self.db=db
    async def words(self,word):
        rows=await (await self.db.execute('SELECT token,popularity FROM dyws_autocomplete.tokens WHERE token LIKE %s ORDER BY popularity DESC,token LIMIT 8',(word+'%',))).fetchall()
        known=any(token==word for token,_ in rows)
        if not known:
            known=bool(await (await self.db.execute('SELECT 1 FROM dyws_autocomplete.tokens WHERE token=%s',(word,))).fetchone())
        options=[]
        for token,popularity in rows:
            if token!=word:options.append((token,.30+.025*(len(token)-len(word))-.01*math.log1p(popularity)))
        if not options and not known and len(word)>=4:
            rows=await (await self.db.execute('SELECT token,popularity FROM dyws_autocomplete.tokens ORDER BY token <-> %s LIMIT 12',(word,))).fetchall()
            for token,popularity in rows:
                edits=distance(word,token)
                if edits<=(2 if len(word)>=8 else 1):
                    options.append((token,.65+.25*edits-.01*math.log1p(popularity)))
        return known,sorted(options,key=lambda row:(row[1],row[0]))[:3]
    async def streets(self,text):
        words=re.findall(r'[a-z0-9]+',text)
        if not words or len(words)>8 or not any(re.search('[a-z]',w) for w in words):return []
        expression=' & '.join("'%s'%s"%(w,'' if any(c.isdigit() for c in w) or len(w)<=2 else ':*') for w in words)
        rows=await (await self.db.execute("SELECT name,normalized,popularity FROM dyws_autocomplete.streets WHERE terms @@ to_tsquery('simple',%s) ORDER BY popularity DESC,name LIMIT 12",(expression,))).fetchall()
        # Numeric street names must match exactly. 91 must never expand to 910.
        numbers=[w for w in words if any(c.isdigit() for c in w)]
        return [name for name,norm,_ in rows if all(n in re.findall(r'[a-z0-9]+',norm) for n in numbers)][:3]

    async def osm_ids(self,name,city):
        city=normalize(city).strip()
        ids=[]
        if city:
            ids=[r[0] for r in await (await self.db.execute("SELECT word_id FROM word WHERE type IN ('W','w') AND word_token=%s",(city,))).fetchall()]
            if not ids:return []
        rows=await (await self.db.execute('SELECT osm_type,osm_id FROM dyws_autocomplete.segments WHERE name=%s AND (%s OR address_tokens && %s::integer[]) ORDER BY place_id LIMIT 2',(name,not bool(city),ids))).fetchall()
        return [kind+str(ident) for kind,ident in rows]


async def word_candidates(query,dictionary,include_original=False):
    matches=[m for m in re.finditer(r'\b[a-z]{3,40}\b',query)]
    if len(matches)>10:return []
    choices=[]
    for index,match in enumerate(matches):
        word=match.group();known,options=await dictionary.words(word)
        # Preserve complete words except short fragments or the final word.
        if known and len(word)>4 and index!=len(matches)-1:options=[]
        if options:choices.append((match,known,options))
    choices=sorted(choices,key=lambda row:(row[1],-row[0].start()))[:3]
    choices.sort(key=lambda row:row[0].start(),reverse=True)
    beam=[Candidate(query,0)]
    for match,known,options in choices:
        next_beam=[]
        for current in beam:
            next_beam.append(Candidate(current.query,current.score+(0 if known else 1.5),current.house,changes=current.changes))
            for replacement,cost in options:
                next_beam.append(Candidate(current.query[:match.start()]+replacement+current.query[match.end():],current.score+cost,current.house,changes=current.changes+(match.start(),)))
        beam=sorted(next_beam,key=lambda c:(c.score,c.query))[:12]
    groups={}
    for candidate in sorted(beam,key=lambda c:(c.score,c.query)):
        if include_original or candidate.query!=query:groups.setdefault(candidate.changes,candidate)
    return list(groups.values())

async def candidates(query,dictionary):
    query=normalize(query)
    output=await word_candidates(query,dictionary)
    street,comma,tail=query.partition(',')
    names=await dictionary.streets(street);house=''
    if not names:
        match=re.fullmatch(r'\s*(\d+[a-z]?)\s+(.+)',street)
        if match:
            house=match.group(1);names=await dictionary.streets(match.group(2))
    for index,name in enumerate(names):
        expanded=((house+' ') if house else '')+name+((', '+tail.strip()) if comma else '')
        if normalize(expanded)==query:continue
        base=Candidate(expanded,.05+.04*index,house)
        # City fragments can coexist with an incomplete street name.
        for c in await word_candidates(normalize(expanded),dictionary,include_original=True):
            output.append(Candidate(c.query,base.score+c.score,house,name))
    unique={}
    for item in sorted(output,key=lambda c:(c.score,c.query)):
        if item.query!=query and item.query not in unique:unique[item.query]=item
    return list(unique.values())[:MAX_CANDIDATES]

def expected_house(query):
    words=re.findall(r'[a-z0-9]+',normalize(query).split(',')[0])
    types={'street','st','str','avenue','ave','av','aven','road','rd','drive','dr','boulevard','blvd','lane','ln','highway','hwy','way','court','ct','place','pl','crescent','cres','nw','ne','sw','se'}
    if len(words)>=2 and re.fullmatch(r'\d+[a-z]?',words[0]) and words[1] not in types:return words[0]
    return ''

class Autocomplete:
    def __init__(self,app,dictionary_factory=None):
        self.app=app;self.dictionary_factory=dictionary_factory;self.slots=asyncio.Semaphore(2)
    async def invoke(self,scope,query,osm_ids=None):
        params=dict(parse_qsl(scope.get('query_string',b'').decode('utf8'),keep_blank_values=True));params['q']=query
        child=dict(scope,query_string=urlencode(params).encode())
        if osm_ids:
            params.pop('q',None);params['osm_ids']=','.join(osm_ids)
            child.update(path='/lookup',raw_path=b'/lookup',query_string=urlencode(params).encode())
        messages=[]
        async def receive():return {'type':'http.request','body':b'','more_body':False}
        async def send(message):messages.append(message)
        await self.app(child,receive,send)
        return messages
    @staticmethod
    def rows(messages):
        if not messages or messages[0].get('status')!=200:return None
        try:
            body=b''.join(m.get('body',b'') for m in messages)
            if len(body)>262144:return None
            rows=json.loads(body)
            return rows if isinstance(rows,list) else None
        except (ValueError,TypeError):return None
    async def expand(self,scope,query):
        osm={}
        if self.dictionary_factory:
            suggestions=await candidates(query,self.dictionary_factory())
        else:
            import psycopg
            async with await psycopg.AsyncConnection.connect(DSN) as db:
                dictionary=Dictionary(db);suggestions=await candidates(query,dictionary)
                for c in suggestions:
                    if c.street and not c.house:osm[c.query]=await dictionary.osm_ids(c.street,c.query.split(',')[1].strip() if ',' in c.query else '')
        async def resolve(candidate):
            if candidate.street and not candidate.house and not osm.get(candidate.query):return []
            messages=await self.invoke(scope,candidate.query,osm.get(candidate.query))
            rows=self.rows(messages) or []
            if candidate.house:
                rows=[r for r in rows if normalize(r.get('address',{}).get('house_number',''))==candidate.house]
            return rows
        # Each request can resolve at most three candidates, in ranked order.
        groups=await asyncio.gather(*(resolve(c) for c in suggestions))
        result=[];seen=set()
        for rows in groups:
            if not rows:continue
            for row in rows:
                key=(row.get('place_id'),row.get('lat'),row.get('lon'),row.get('display_name'))
                if key not in seen:result.append(row);seen.add(key)
            if result:break
        return result
    async def civic(self,query,params):
        if params.get('countrycodes','ca').lower()!='ca':return []
        if any(key in params for key in ('viewbox','bounded','exclude_place_ids','featuretype')):return []
        import psycopg
        from civic_addresses import search
        limit=max(1,min(5,int(params.get('limit','5'))))
        async with await psycopg.AsyncConnection.connect(DSN) as db:
            return await search(db,query,limit)

    @staticmethod
    def response(messages,rows,expanded=False):
        body=json.dumps(rows,ensure_ascii=False,separators=(',',':')).encode()
        headers=[(k,v) for k,v in messages[0].get('headers',[]) if k.lower() not in (b'content-length',b'etag')]
        headers.append((b'content-length',str(len(body)).encode()))
        if expanded:headers.append((b'x-dyws-match',b'expanded'))
        return [dict(messages[0],headers=headers),{'type':'http.response.body','body':body}]
    async def __call__(self,scope,receive,send):
        if scope['type']!='http' or scope.get('method')!='GET' or scope.get('path')!='/search':
            return await self.app(scope,receive,send)
        try:params=dict(parse_qsl(scope.get('query_string',b'').decode('utf8')))
        except UnicodeError:return await self.app(scope,receive,send)
        query=params.get('q','')
        if not 3<=len(query)<=240 or params.get('format','jsonv2')!='jsonv2' or any(k.startswith('polygon_') for k in params) or params.get('json_callback'):
            return await self.app(scope,receive,send)
        civic=[]
        if self.dictionary_factory is None and not self.slots.locked():
            try:
                async with self.slots:
                    civic=await asyncio.wait_for(self.civic(query,params),1.0)
            except Exception:
                pass
        if civic:
            messages=[{'type':'http.response.start','status':200,'headers':[(b'content-type',b'application/json; charset=utf-8')]}]
            for message in self.response(messages,civic):await send(message)
            return
        messages=await self.invoke(scope,query)
        house=expected_house(query) if params.get('addressdetails')=='1' else ''
        native=self.rows(messages)
        if house and native:
            filtered=[r for r in native if normalize(r.get('address',{}).get('house_number',''))==house]
            if len(filtered)!=len(native):messages=self.response(messages,filtered)
        if self.rows(messages)==[] and not self.slots.locked():
            try:
                async with self.slots:
                    rows=await asyncio.wait_for(self.expand(scope,query),MAX_SECONDS)
                limit=max(1,min(40,int(params.get('limit','10'))))
                if house:rows=[r for r in rows if normalize(r.get('address',{}).get('house_number',''))==house]
                if rows:messages=self.response(messages,rows[:limit],expanded=True)
            except Exception:
                # Optional refinement must not change normal geocoder availability.
                pass
        for message in messages:await send(message)

def run_wsgi():
    from nominatim_api.server.falcon.server import run_wsgi as nominatim_app
    return Autocomplete(nominatim_app())
