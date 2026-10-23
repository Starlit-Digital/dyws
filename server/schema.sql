CREATE TABLE IF NOT EXISTS orders (
 id TEXT PRIMARY KEY, tenant TEXT NOT NULL, request_key TEXT NOT NULL, fingerprint TEXT NOT NULL,
 tracking_hash TEXT NOT NULL, tracking_expires INTEGER NOT NULL, status TEXT NOT NULL,
 payment_status TEXT NOT NULL, fulfillment TEXT NOT NULL, customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL,
 address TEXT NOT NULL, notes TEXT NOT NULL, lines_json TEXT NOT NULL,
 subtotal INTEGER NOT NULL CHECK(subtotal>=0), tax INTEGER NOT NULL CHECK(tax>=0), delivery_fee INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL CHECK(total>=0),
 driver_id TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(tenant,request_key), UNIQUE(tenant,id)
);
CREATE INDEX IF NOT EXISTS orders_tenant_created ON orders(tenant,created_at);
CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY,tenant TEXT NOT NULL,order_id TEXT NOT NULL,status TEXT NOT NULL,actor TEXT NOT NULL,created_at INTEGER NOT NULL,FOREIGN KEY(tenant,order_id) REFERENCES orders(tenant,id));
CREATE TABLE IF NOT EXISTS payments(id INTEGER PRIMARY KEY,tenant TEXT NOT NULL,order_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('capture','refund')),amount INTEGER NOT NULL CHECK(amount>0),created_at INTEGER NOT NULL,UNIQUE(tenant,order_id,kind),FOREIGN KEY(tenant,order_id) REFERENCES orders(tenant,id));
CREATE TABLE IF NOT EXISTS locations(tenant TEXT NOT NULL,order_id TEXT NOT NULL,driver_id TEXT NOT NULL,latitude REAL NOT NULL,longitude REAL NOT NULL,accuracy REAL NOT NULL,recorded_at INTEGER NOT NULL,PRIMARY KEY(tenant,order_id),FOREIGN KEY(tenant,order_id) REFERENCES orders(tenant,id));
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,tenant TEXT NOT NULL,role TEXT NOT NULL,subject TEXT NOT NULL,expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS limits(bucket TEXT PRIMARY KEY,hits INTEGER NOT NULL,expires_at INTEGER NOT NULL);
