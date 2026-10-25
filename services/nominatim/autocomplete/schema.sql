-- Owned supplementary indexes. Nominatim's tables and tokenizer stay untouched.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE SCHEMA IF NOT EXISTS dyws_autocomplete AUTHORIZATION "dyws-nominatim";
CREATE TABLE IF NOT EXISTS dyws_autocomplete.tokens (
 token text COLLATE "C" PRIMARY KEY,
 popularity bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS dyws_tokens_prefix ON dyws_autocomplete.tokens (token text_pattern_ops);
CREATE INDEX IF NOT EXISTS dyws_tokens_similar ON dyws_autocomplete.tokens USING gist (token gist_trgm_ops);
CREATE TABLE IF NOT EXISTS dyws_autocomplete.streets (
 name text PRIMARY KEY,
 normalized text NOT NULL,
 terms tsvector NOT NULL,
 popularity bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS dyws_streets_prefix ON dyws_autocomplete.streets USING gin (terms);
CREATE TABLE IF NOT EXISTS dyws_autocomplete.metadata (
 id boolean PRIMARY KEY DEFAULT true CHECK (id),
 refreshed_at timestamptz NOT NULL,
 token_count integer NOT NULL,
 street_count integer NOT NULL
);
GRANT USAGE ON SCHEMA dyws_autocomplete TO "dyws-geocoder";
GRANT SELECT ON ALL TABLES IN SCHEMA dyws_autocomplete TO "dyws-geocoder";
CREATE TABLE IF NOT EXISTS dyws_autocomplete.segments (
 place_id bigint PRIMARY KEY,
 osm_type char(1) NOT NULL,
 osm_id bigint NOT NULL,
 name text NOT NULL,
 address_tokens integer[] NOT NULL
);
CREATE INDEX IF NOT EXISTS dyws_segments_name ON dyws_autocomplete.segments (name);
GRANT SELECT ON dyws_autocomplete.segments TO "dyws-geocoder";
