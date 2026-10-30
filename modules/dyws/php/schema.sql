CREATE TABLE IF NOT EXISTS orders (
 cancellation_window_minutes INTEGER NOT NULL DEFAULT 0 CHECK(cancellation_window_minutes BETWEEN 0 AND 1440),
 customer_cancelled_at INTEGER,
 cancellation_payment_state TEXT NOT NULL DEFAULT '',
 id TEXT PRIMARY KEY, tenant TEXT NOT NULL, request_key TEXT NOT NULL, fingerprint TEXT NOT NULL,
 tracking_hash TEXT NOT NULL, tracking_expires INTEGER NOT NULL, status TEXT NOT NULL,
 payment_status TEXT NOT NULL, fulfillment TEXT NOT NULL, customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL,
 address TEXT NOT NULL, notes TEXT NOT NULL, lines_json TEXT NOT NULL,
 subtotal INTEGER NOT NULL CHECK(subtotal>=0), tax INTEGER NOT NULL CHECK(tax>=0), delivery_fee INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL CHECK(total>=0),
 fulfillment_meta_json TEXT NOT NULL DEFAULT '{}',
 tip INTEGER NOT NULL DEFAULT 0 CHECK(tip>=0 AND tip%100=0), driver_id TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(tenant,request_key), UNIQUE(tenant,id)
);
CREATE INDEX IF NOT EXISTS orders_tenant_created ON orders(tenant,created_at);
CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY,tenant TEXT NOT NULL,order_id TEXT NOT NULL,status TEXT NOT NULL,actor TEXT NOT NULL,created_at INTEGER NOT NULL,FOREIGN KEY(tenant,order_id) REFERENCES orders(tenant,id));
CREATE TABLE IF NOT EXISTS payments(id INTEGER PRIMARY KEY,tenant TEXT NOT NULL,order_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('capture','refund')),amount INTEGER NOT NULL CHECK(amount>0),created_at INTEGER NOT NULL,UNIQUE(tenant,order_id,kind),FOREIGN KEY(tenant,order_id) REFERENCES orders(tenant,id));
CREATE TABLE IF NOT EXISTS locations(tenant TEXT NOT NULL,order_id TEXT NOT NULL,driver_id TEXT NOT NULL,latitude REAL NOT NULL,longitude REAL NOT NULL,accuracy REAL NOT NULL,recorded_at INTEGER NOT NULL,PRIMARY KEY(tenant,order_id),FOREIGN KEY(tenant,order_id) REFERENCES orders(tenant,id));
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,tenant TEXT NOT NULL,role TEXT NOT NULL,subject TEXT NOT NULL,expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS limits(bucket TEXT PRIMARY KEY,hits INTEGER NOT NULL,expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS payment_attempts (
 tenant TEXT NOT NULL, order_id TEXT NOT NULL, nonce TEXT NOT NULL, session_id TEXT UNIQUE,
 payment_intent TEXT, checkout_url TEXT, status TEXT NOT NULL, amount INTEGER NOT NULL, currency TEXT NOT NULL,
 created_at INTEGER NOT NULL, PRIMARY KEY(tenant,order_id),
 FOREIGN KEY(tenant,order_id) REFERENCES orders(tenant,id)
);
CREATE TABLE IF NOT EXISTS payment_events (tenant TEXT NOT NULL,event_id TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(tenant,event_id));

CREATE TABLE IF NOT EXISTS payment_refund_deltas (tenant TEXT NOT NULL,event_id TEXT NOT NULL,order_id TEXT NOT NULL,amount INTEGER NOT NULL CHECK(amount>0),subtotal INTEGER NOT NULL,tax INTEGER NOT NULL,delivery_fee INTEGER NOT NULL,created_at INTEGER NOT NULL,tip INTEGER NOT NULL DEFAULT 0 CHECK(tip>=0),PRIMARY KEY(tenant,event_id),FOREIGN KEY(tenant,order_id) REFERENCES orders(tenant,id));

CREATE TABLE IF NOT EXISTS location_shares (
 tenant TEXT NOT NULL, order_id TEXT NOT NULL, driver_id TEXT NOT NULL,
 sharing_hash TEXT NOT NULL, auth_hash TEXT NOT NULL, source TEXT NOT NULL,
 expires_at INTEGER NOT NULL, PRIMARY KEY(tenant,order_id),
 FOREIGN KEY(tenant,order_id) REFERENCES orders(tenant,id)
);

CREATE TABLE IF NOT EXISTS realtime_versions(channel TEXT PRIMARY KEY,revision TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS delivery_runs (
 tenant TEXT NOT NULL,id TEXT NOT NULL,driver_id TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('planned','active','completed','cancelled')),
 request_key TEXT NOT NULL,revision INTEGER NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,
 PRIMARY KEY(tenant,id),UNIQUE(tenant,request_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS delivery_runs_one_open_driver ON delivery_runs(tenant,driver_id) WHERE status IN ('planned','active');
CREATE TABLE IF NOT EXISTS delivery_run_stops (
 tenant TEXT NOT NULL,run_id TEXT NOT NULL,order_id TEXT NOT NULL,position INTEGER NOT NULL CHECK(position>0),active INTEGER NOT NULL CHECK(active IN (0,1)),
 PRIMARY KEY(tenant,run_id,order_id),
 FOREIGN KEY(tenant,run_id) REFERENCES delivery_runs(tenant,id),FOREIGN KEY(tenant,order_id) REFERENCES orders(tenant,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS delivery_run_one_open_order ON delivery_run_stops(tenant,order_id) WHERE active=1;
CREATE INDEX IF NOT EXISTS delivery_run_stop_order ON delivery_run_stops(tenant,run_id,position);

-- Remembered checkout details are separate from order records and operator sessions.
CREATE TABLE IF NOT EXISTS guest_details (
 tenant TEXT NOT NULL, id TEXT NOT NULL, token_hash TEXT NOT NULL,
 customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL,
 default_address_id TEXT, expires_at INTEGER NOT NULL,
 PRIMARY KEY(tenant,id), UNIQUE(tenant,token_hash)
);
CREATE INDEX IF NOT EXISTS guest_details_expiry ON guest_details(tenant,expires_at);
CREATE TABLE IF NOT EXISTS guest_addresses (
 tenant TEXT NOT NULL, profile_id TEXT NOT NULL, id TEXT NOT NULL,
 label TEXT NOT NULL, address_json TEXT NOT NULL, created_at INTEGER NOT NULL,
 PRIMARY KEY(tenant,profile_id,id),
 FOREIGN KEY(tenant,profile_id) REFERENCES guest_details(tenant,id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS orders_driver_tips ON orders(tenant,driver_id,status);
CREATE INDEX IF NOT EXISTS events_order_status ON events(tenant,order_id,status,created_at);

CREATE TABLE IF NOT EXISTS cancellation_jobs (
 tenant TEXT NOT NULL,order_id TEXT NOT NULL,next_attempt INTEGER NOT NULL,
 lease TEXT NOT NULL DEFAULT '',lease_until INTEGER NOT NULL DEFAULT 0,attempts INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(tenant,order_id),FOREIGN KEY(tenant,order_id) REFERENCES orders(tenant,id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS integration_keys (
 id TEXT NOT NULL, tenant TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL, scopes_json TEXT NOT NULL, parent_id TEXT,
 created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, revoked_at INTEGER,
 last_used_at INTEGER, PRIMARY KEY(tenant,id),
 FOREIGN KEY(tenant,parent_id) REFERENCES integration_keys(tenant,id)
);
CREATE INDEX IF NOT EXISTS integration_keys_parent ON integration_keys(tenant,parent_id);
CREATE TABLE IF NOT EXISTS integration_audit (
 id INTEGER PRIMARY KEY, tenant TEXT NOT NULL, key_id TEXT,
 actor TEXT NOT NULL, action TEXT NOT NULL, outcome TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS integration_audit_tenant ON integration_audit(tenant,created_at);
