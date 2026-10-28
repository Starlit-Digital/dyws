CREATE TABLE IF NOT EXISTS deal_claims (
 tenant TEXT NOT NULL, id TEXT NOT NULL, owner TEXT NOT NULL, deal_id TEXT NOT NULL,
 deal_json TEXT NOT NULL, claimed_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
 active INTEGER NOT NULL DEFAULT 0 CHECK(active IN (0,1)), used_order_id TEXT,
 PRIMARY KEY(tenant,id), UNIQUE(tenant,owner,deal_id)
);
CREATE INDEX IF NOT EXISTS deal_claims_owner ON deal_claims(tenant,owner,active,expires_at);

CREATE INDEX IF NOT EXISTS deal_claims_expiry ON deal_claims(tenant,expires_at);
