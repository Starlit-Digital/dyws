import unittest
from civic_addresses import tokens,search

class Database:
    def __init__(self,rows):self.rows=rows;self.params=None
    async def execute(self,sql,params):self.params=params;return self
    async def fetchall(self):return self.rows

class Tests(unittest.IsolatedAsyncioTestCase):
    def test_aliases_and_identifiers(self):
        self.assertEqual(tokens('123 132 A Avenue NW, Edmonton, Alberta'),['123','132a','ave','nw','edmonton','ab'])
    async def test_exact_house_and_numeric_street(self):
        db=Database([('123','132A AVE NW','Edmonton','',53.5,-113.4)])
        rows=await search(db,'123 132a ave')
        self.assertEqual(db.params,('123',"'132a' & 'ave':*",5))
        self.assertEqual(rows[0]['address']['house_number'],'123')
        self.assertNotIn('postcode',rows[0]['address'])
        self.assertIn('Statistics Canada',rows[0]['licence'])
    async def test_non_address_queries_skip_civic_index(self):
        db=Database([])
        self.assertEqual(await search(db,'Edmonton City Hall'),[])
        self.assertIsNone(db.params)
    async def test_direction_and_city(self):
        db=Database([]);await search(db,'123 Main Street NW, Calgary, AB')
        self.assertEqual(db.params[1],"'main':* & 'st':* & 'nw' & 'calgary':*")

if __name__=='__main__':unittest.main()
