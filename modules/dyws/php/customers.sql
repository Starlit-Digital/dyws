CREATE TABLE IF NOT EXISTS customers (
 tenant TEXT NOT NULL, id TEXT NOT NULL, email TEXT NOT NULL,
 created_at INTEGER NOT NULL, verified_at INTEGER NOT NULL,
 PRIMARY KEY(tenant,id), UNIQUE(tenant,email)
);
CREATE TABLE IF NOT EXISTS customer_links (
 tenant TEXT NOT NULL, token_hash TEXT NOT NULL, email TEXT NOT NULL,
 expires_at INTEGER NOT NULL, PRIMARY KEY(tenant,token_hash)
);
CREATE INDEX IF NOT EXISTS customer_links_expiry ON customer_links(tenant,expires_at);
CREATE TABLE IF NOT EXISTS customer_sessions (
 tenant TEXT NOT NULL, token_hash TEXT NOT NULL, customer_id TEXT NOT NULL,
 expires_at INTEGER NOT NULL, PRIMARY KEY(tenant,token_hash),
 FOREIGN KEY(tenant,customer_id) REFERENCES customers(tenant,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS customer_sessions_expiry ON customer_sessions(tenant,expires_at);
CREATE INDEX IF NOT EXISTS orders_customer_history ON orders(tenant,customer_id,created_at,id);
CREATE TABLE IF NOT EXISTS customer_driver_reports (
 id INTEGER PRIMARY KEY, tenant TEXT NOT NULL, customer_id TEXT NOT NULL,
 order_id TEXT NOT NULL, driver_id TEXT NOT NULL, reason TEXT NOT NULL,
 details TEXT NOT NULL, created_at INTEGER NOT NULL,
 UNIQUE(tenant,customer_id,order_id),
 FOREIGN KEY(tenant,customer_id) REFERENCES customers(tenant,id),
 FOREIGN KEY(tenant,order_id) REFERENCES orders(tenant,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS customer_driver_blocks (
 tenant TEXT NOT NULL, customer_id TEXT NOT NULL, driver_id TEXT NOT NULL,
 source_order_id TEXT NOT NULL, created_at INTEGER NOT NULL,
 PRIMARY KEY(tenant,customer_id,driver_id),
 FOREIGN KEY(tenant,customer_id) REFERENCES customers(tenant,id)
);
