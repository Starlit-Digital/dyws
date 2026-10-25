CREATE SCHEMA IF NOT EXISTS dyws_civic AUTHORIZATION "dyws-nominatim";
CREATE TABLE IF NOT EXISTS dyws_civic.addresses (
 house text NOT NULL,road text NOT NULL,city text NOT NULL,postal text NOT NULL,
 latitude double precision NOT NULL CHECK(latitude BETWEEN 48 AND 61),
 longitude double precision NOT NULL CHECK(longitude BETWEEN -121 AND -109),
 terms tsvector NOT NULL,
 PRIMARY KEY(house,road,city)
);
CREATE INDEX IF NOT EXISTS dyws_civic_house ON dyws_civic.addresses(house);
CREATE INDEX IF NOT EXISTS dyws_civic_terms ON dyws_civic.addresses USING gin(terms);
CREATE TABLE IF NOT EXISTS dyws_civic.metadata (
 id boolean PRIMARY KEY DEFAULT true CHECK(id),reference_date text NOT NULL,
 imported_at timestamptz NOT NULL,source_url text NOT NULL,sha256 text NOT NULL,
 rows_count bigint NOT NULL,municipalities bigint NOT NULL
);
GRANT USAGE ON SCHEMA dyws_civic TO "dyws-geocoder";
GRANT SELECT ON ALL TABLES IN SCHEMA dyws_civic TO "dyws-geocoder";
