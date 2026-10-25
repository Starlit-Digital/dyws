#!/usr/bin/env python3
"""Transactional Alberta-only import from the official June 2026 NAR archive."""
import argparse,csv,hashlib,io,json,re,zipfile
from pathlib import Path
import psycopg
from civic_addresses import tokens

URL='https://www150.statcan.gc.ca/n1/pub/46-26-0002/2022001/202606.zip'
DSN='dbname=dyws_nominatim host=/run/postgresql port=5433'

def clean(value):return re.sub(r'\s+',' ',value or '').strip()
def records(z,name):
    with z.open(name) as f:yield from csv.DictReader(io.TextIOWrapper(f,encoding='utf-8-sig'))
def main():
    parser=argparse.ArgumentParser();parser.add_argument('archive',type=Path);args=parser.parse_args()
    with args.archive.open('rb') as source: digest=hashlib.file_digest(source,'sha256').hexdigest()
    with zipfile.ZipFile(args.archive) as z,psycopg.connect(DSN) as db:
        if not db.execute('SELECT pg_try_advisory_xact_lock(70439262)').fetchone()[0]:raise RuntimeError('Civic import already running')
        db.execute(Path(__file__).with_name('civic_schema.sql').read_text())
        db.execute("SET LOCAL statement_timeout='10min'")
        db.execute('CREATE TEMP TABLE civic_locations (id text PRIMARY KEY,lat double precision,lon double precision) ON COMMIT DROP')
        location_count=0
        with db.cursor().copy('COPY civic_locations FROM STDIN') as copy:
            for name in z.namelist():
                if not re.fullmatch(r'Locations/Location_48(?:_part_\d+)?\.csv',name):continue
                for r in records(z,name):
                    try:lat=float(r['BG_LATITUDE']);lon=float(r['BG_LONGITUDE'])
                    except ValueError:continue
                    if not (48<=lat<=61 and -121<=lon<=-109):continue
                    copy.write_row((r['LOC_GUID'],lat,lon));location_count+=1
        db.execute('CREATE TEMP TABLE civic_raw (id text,house text,road text,city text,postal text,search_text text) ON COMMIT DROP')
        raw_count=0
        with db.cursor().copy('COPY civic_raw FROM STDIN') as copy:
            for name in z.namelist():
                if not re.fullmatch(r'Addresses/Address_48(?:_part_\d+)?\.csv',name):continue
                for r in records(z,name):
                    if r['PROV_CODE']!='48':raise RuntimeError('Unexpected province')
                    house=clean(r['CIVIC_NO']+r['CIVIC_NO_SUFFIX']).upper()
                    if not re.fullmatch(r'\d+[A-Z]?',house):continue
                    road=' '.join(filter(None,[clean(r['OFFICIAL_STREET_NAME']),clean(r['OFFICIAL_STREET_TYPE']),clean(r['OFFICIAL_STREET_DIR'])]))
                    city=clean(r['CSD_ENG_NAME']);postal=clean(r['MAIL_POSTAL_CODE']).upper().replace(' ','')
                    if not road or not city:continue
                    postal=postal[:3]+' '+postal[3:] if re.fullmatch(r'[A-Z]\d[A-Z]\d[A-Z]\d',postal) else ''
                    # Index official and mailing street aliases, but retain official display.
                    aliases=' '.join([road,city,r['MAIL_STREET_NAME'],r['MAIL_STREET_TYPE'],r['MAIL_STREET_DIR'],r['MAIL_MUN_NAME']])
                    copy.write_row((r['LOC_GUID'],house,road,city,postal,' '.join(tokens(aliases))));raw_count+=1
        print(json.dumps({'phase':'staged','locations':location_count,'addresses':raw_count}),flush=True)
        db.execute('ANALYZE civic_locations');db.execute('ANALYZE civic_raw')
        db.execute('''CREATE TEMP TABLE civic_ready ON COMMIT DROP AS
            SELECT house,road,city,CASE WHEN count(DISTINCT postal)=1 THEN min(postal) ELSE '' END AS postal,
              min(l.lat) AS latitude,min(l.lon) AS longitude,
              to_tsvector('simple',min(r.search_text)) AS terms
            FROM civic_raw r JOIN civic_locations l ON l.id=r.id GROUP BY house,road,city''')
        count,cities=db.execute('SELECT count(*),count(DISTINCT city) FROM civic_ready').fetchone()
        if count<500000 or cities<100:raise RuntimeError('Unexpectedly small Alberta coverage')
        previous=db.execute('SELECT rows_count FROM dyws_civic.metadata WHERE id').fetchone()
        if previous and count<previous[0]*.9:raise RuntimeError('Coverage dropped more than 10 percent')
        # DELETE/INSERT uses MVCC: readers keep the previous snapshot until commit.
        db.execute('DELETE FROM dyws_civic.addresses')
        db.execute('INSERT INTO dyws_civic.addresses SELECT * FROM civic_ready')
        db.execute('ANALYZE dyws_civic.addresses')
        db.execute('''INSERT INTO dyws_civic.metadata VALUES(true,'2026-06',now(),%s,%s,%s,%s)
          ON CONFLICT(id) DO UPDATE SET reference_date=excluded.reference_date,imported_at=excluded.imported_at,
          source_url=excluded.source_url,sha256=excluded.sha256,rows_count=excluded.rows_count,municipalities=excluded.municipalities''',(URL,digest,count,cities))
    print(json.dumps({'phase':'committed','addresses':count,'municipalities':cities,'sha256':digest}),flush=True)
if __name__=='__main__':main()
