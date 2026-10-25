#!/usr/bin/env python3
"""Refresh supplementary indexes transactionally after successful OSM updates."""
from pathlib import Path
import json
import psycopg

DSN = 'dbname=dyws_nominatim host=/run/postgresql port=5433'

def main():
    with psycopg.connect(DSN) as db:
        # A second updater must not overlap this one. Reads remain available via MVCC.
        if not db.execute('SELECT pg_try_advisory_xact_lock(70439261)').fetchone()[0]:
            raise RuntimeError('Autocomplete refresh already running')
        db.execute(Path(__file__).with_name('schema.sql').read_text())
        db.execute("SET LOCAL statement_timeout = '90s'")
        db.execute("""CREATE TEMP TABLE fresh_tokens ON COMMIT DROP AS
            SELECT word_token AS token,
                   max(coalesce((info->>'count')::bigint,0)+coalesce((info->>'addr_count')::bigint,0)+1) AS popularity
            FROM word WHERE type='w' AND word_token ~ '^[a-z]{3,40}$'
            GROUP BY word_token""")
        db.execute('''INSERT INTO dyws_autocomplete.tokens SELECT * FROM fresh_tokens
            ON CONFLICT(token) DO UPDATE SET popularity=excluded.popularity
            WHERE tokens.popularity<>excluded.popularity''')
        db.execute('DELETE FROM dyws_autocomplete.tokens t WHERE NOT EXISTS (SELECT FROM fresh_tokens f WHERE f.token=t.token)')
        db.execute("""CREATE TEMP TABLE fresh_streets ON COMMIT DROP AS
            SELECT name,lower(unaccent(name)) AS normalized,
                   to_tsvector('simple',lower(unaccent(name))) AS terms,count(*) AS popularity
            FROM (SELECT coalesce(name->'name:en',name->'name') AS name
                  FROM placex WHERE class='highway' AND rank_address=26 AND linked_place_id IS NULL) p
            WHERE name IS NOT NULL AND length(name) BETWEEN 3 AND 120 GROUP BY name""")
        db.execute('''INSERT INTO dyws_autocomplete.streets SELECT * FROM fresh_streets
            ON CONFLICT(name) DO UPDATE SET normalized=excluded.normalized,terms=excluded.terms,popularity=excluded.popularity
            WHERE streets.normalized<>excluded.normalized OR streets.popularity<>excluded.popularity''')
        db.execute('DELETE FROM dyws_autocomplete.streets s WHERE NOT EXISTS (SELECT FROM fresh_streets f WHERE f.name=s.name)')
        db.execute('''CREATE TEMP TABLE fresh_segments ON COMMIT DROP AS
            SELECT p.place_id,p.osm_type,p.osm_id,coalesce(p.name->'name:en',p.name->'name') AS name,s.nameaddress_vector AS address_tokens
            FROM placex p JOIN search_name s USING(place_id)
            WHERE p.class='highway' AND p.rank_address=26 AND p.linked_place_id IS NULL
              AND coalesce(p.name->'name:en',p.name->'name') IS NOT NULL''')
        db.execute('''INSERT INTO dyws_autocomplete.segments SELECT * FROM fresh_segments
            ON CONFLICT(place_id) DO UPDATE SET osm_type=excluded.osm_type,osm_id=excluded.osm_id,name=excluded.name,address_tokens=excluded.address_tokens
            WHERE (segments.osm_type,segments.osm_id,segments.name,segments.address_tokens) IS DISTINCT FROM (excluded.osm_type,excluded.osm_id,excluded.name,excluded.address_tokens)''')
        db.execute('DELETE FROM dyws_autocomplete.segments s WHERE NOT EXISTS (SELECT FROM fresh_segments f WHERE f.place_id=s.place_id)')
        db.execute('ANALYZE dyws_autocomplete.segments')
        counts=db.execute('SELECT (SELECT count(*) FROM dyws_autocomplete.tokens),(SELECT count(*) FROM dyws_autocomplete.streets)').fetchone()
        if counts[0]<1000 or counts[1]<1000:
            raise RuntimeError('Autocomplete source data is unexpectedly small')
        db.execute('''INSERT INTO dyws_autocomplete.metadata VALUES(true,now(),%s,%s)
            ON CONFLICT(id) DO UPDATE SET refreshed_at=excluded.refreshed_at,token_count=excluded.token_count,street_count=excluded.street_count''',counts)
        db.execute('ANALYZE dyws_autocomplete.tokens');db.execute('ANALYZE dyws_autocomplete.streets')
    print(json.dumps({'autocompleteTokens':counts[0],'streetNames':counts[1],'refresh':'committed'}))

if __name__=='__main__':
    main()
