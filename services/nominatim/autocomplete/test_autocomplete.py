"""Deterministic matching and ASGI behavior without an external service."""
import asyncio
import json
import unittest
from urllib.parse import parse_qs,urlencode
from dyws_autocomplete import Autocomplete,candidates,distance,normalize,expected_house

class FakeDictionary:
    async def words(self,word):
        data={'jasp':(False,[('jasper',.3)]),'edm':(False,[('edmonton',.3)]),'hal':(False,[('hall',.3)]),'edmotnon':(False,[('edmonton',.9)]),'str':(False,[('street',.3)])}
        return data.get(word,(True,[]))
    async def streets(self,text):
        return {'jasp':['Jasper Avenue NW','Jasper Road','Jasper Street'],'91 str nw':['91 Street NW']}.get(text.strip(),[])

class Tests(unittest.IsolatedAsyncioTestCase):
    async def test_prefixes_with_city(self):
        rows=await candidates('Jasp, Edm',FakeDictionary())
        self.assertEqual(rows[0].query,'jasper avenue nw, edmonton')
        self.assertLessEqual(len(rows),3)
        self.assertTrue(all('edmonton' in row.query for row in rows))
    async def test_numbers_preserved(self):
        rows=await candidates('16767 91 Str NW, Edm',FakeDictionary())
        self.assertEqual(rows[0].query,'16767 91 street nw, edmonton')
        self.assertEqual(rows[0].house,'16767')
        self.assertTrue(all(row.query.startswith('16767 91 ') for row in rows))
    async def test_typos(self):
        rows=await candidates('Edmotnon City Hall',FakeDictionary())
        self.assertEqual(rows[0].query,'edmonton city hall')
        self.assertEqual(distance('edmotnon','edmonton'),1)
        self.assertEqual(normalize('Café'), 'cafe')
    async def test_opaque_unmatched_input(self):
        self.assertEqual(await candidates('12345678 909',FakeDictionary()),[])
    def test_house_detection_preserves_numbered_streets(self):
        for query in ['91 Street NW, Edmonton','103A Avenue NW','91 Str NW']:
            self.assertEqual(expected_house(query),'')
        self.assertEqual(expected_house('16767 91 Street NW, Edmonton'),'16767')
        self.assertEqual(expected_house('1 103A Aven NW, Edm'),'1')
    async def test_wrong_house_is_never_suggested(self):
        async def app(scope,receive,send):
            await send({'type':'http.response.start','status':200,'headers':[]})
            await send({'type':'http.response.body','body':json.dumps([{'address':{'house_number':'5303'}}]).encode()})
        output=[]
        async def send(message):output.append(message)
        wrapper=Autocomplete(app,FakeDictionary)
        await wrapper({'type':'http','method':'GET','path':'/search','query_string':urlencode({'q':'16767 91 Street NW, Edmonton','format':'jsonv2','addressdetails':1}).encode()},None,send)
        self.assertEqual(wrapper.rows(output),[])
    async def test_best_candidate_does_not_mix_alternate_places(self):
        async def app(scope,receive,send):
            query=parse_qs(scope['query_string'].decode())['q'][0]
            rows=[] if query=='Edmotnon City Hal' else [{'display_name':query}]
            await send({'type':'http.response.start','status':200,'headers':[]})
            await send({'type':'http.response.body','body':json.dumps(rows).encode()})
        output=[]
        async def send(message):output.append(message)
        wrapper=Autocomplete(app,FakeDictionary)
        await wrapper({'type':'http','method':'GET','path':'/search','query_string':urlencode({'q':'Edmotnon City Hal','format':'jsonv2'}).encode()},None,send)
        self.assertEqual(wrapper.rows(output),[{'display_name':'edmonton city hall'}])
    async def test_civic_result_precedes_native_search(self):
        async def app(scope,receive,send):raise AssertionError('Native search should not run')
        class CivicWrapper(Autocomplete):
            async def civic(self,query,params):return [{'address':{'house_number':'123'},'display_name':'123 Example Street'}]
        output=[]
        async def send(message):output.append(message)
        wrapper=CivicWrapper(app)
        await wrapper({'type':'http','method':'GET','path':'/search','query_string':b'q=123+Example+St&format=jsonv2&addressdetails=1'},None,send)
        self.assertEqual(wrapper.rows(output)[0]['address']['house_number'],'123')

    async def test_wrapper(self):
        queries=[]
        async def app(scope,receive,send):
            query=parse_qs(scope['query_string'].decode())['q'][0];queries.append(query)
            rows=[{'place_id':1,'lat':'53','lon':'-113','display_name':'City Hall','address':{'house_number':'1'}}] if query.lower()=='edmonton city hall' else []
            body=json.dumps(rows).encode();await send({'type':'http.response.start','status':200,'headers':[(b'content-type',b'application/json'),(b'content-length',str(len(body)).encode())]});await send({'type':'http.response.body','body':body})
        wrapper=Autocomplete(app,FakeDictionary)
        async def lookup(query):
            output=[]
            async def send(message):output.append(message)
            await wrapper({'type':'http','method':'GET','path':'/search','query_string':urlencode({'q':query,'format':'jsonv2','limit':5}).encode()},None,send)
            return output
        result=await lookup('Edmonton City Hall');self.assertEqual(queries,['Edmonton City Hall']);self.assertEqual(len(wrapper.rows(result)),1)
        queries.clear();result=await lookup('Edmotnon City Hall');self.assertEqual(len(wrapper.rows(result)),1);self.assertIn((b'x-dyws-match',b'expanded'),result[0]['headers']);self.assertLessEqual(len(queries),4)
        self.assertEqual(int(dict(result[0]['headers'])[b'content-length']),len(result[1]['body']))
    async def test_dictionary_failure_retains_native_response(self):
        async def app(scope,receive,send):
            await send({'type':'http.response.start','status':200,'headers':[]});await send({'type':'http.response.body','body':b'[]'})
        def failed():raise RuntimeError('private connection detail')
        output=[]
        async def send(message):output.append(message)
        wrapper=Autocomplete(app,failed)
        await wrapper({'type':'http','method':'GET','path':'/search','query_string':b'q=Jasp&format=jsonv2'},None,send)
        self.assertEqual(wrapper.rows(output),[])
        self.assertNotIn('private',str(output))

if __name__=='__main__':unittest.main()
