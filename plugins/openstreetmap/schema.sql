CREATE TABLE IF NOT EXISTS osm_address_geography (
 tenant TEXT NOT NULL,address_hash TEXT NOT NULL,
 latitude REAL,longitude REAL,status TEXT NOT NULL CHECK(status IN ('located','unmatched')),
 updated_at INTEGER NOT NULL,
 PRIMARY KEY(tenant,address_hash),
 CHECK(latitude IS NULL OR latitude BETWEEN -90 AND 90),
 CHECK(longitude IS NULL OR longitude BETWEEN -180 AND 180),
 CHECK((status='located' AND latitude IS NOT NULL AND longitude IS NOT NULL) OR (status='unmatched' AND latitude IS NULL AND longitude IS NULL))
);
CREATE TABLE IF NOT EXISTS osm_geocode_leases (
 tenant TEXT NOT NULL,address_hash TEXT NOT NULL,token TEXT NOT NULL,expires_at INTEGER NOT NULL,
 PRIMARY KEY(tenant,address_hash)
);
