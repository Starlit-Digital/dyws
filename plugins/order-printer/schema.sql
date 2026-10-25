CREATE TABLE IF NOT EXISTS printer_devices (
 tenant TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL, location_id TEXT NOT NULL,
 profile TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, order_cursor INTEGER NOT NULL DEFAULT 0,
 enrollment_hash TEXT NOT NULL, enrollment_expires INTEGER NOT NULL,
 token_hash TEXT, device_id TEXT, last_seen INTEGER, device_status TEXT NOT NULL DEFAULT 'unpaired',
 PRIMARY KEY(tenant,id), UNIQUE(tenant,token_hash)
);
CREATE TABLE IF NOT EXISTS printer_jobs (
 tenant TEXT NOT NULL, id TEXT NOT NULL, printer_id TEXT NOT NULL, order_id TEXT,
 dedupe_key TEXT NOT NULL, kind TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'queued',
 payload TEXT NOT NULL, lease_hash TEXT, lease_until INTEGER, attempts INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 PRIMARY KEY(tenant,id), UNIQUE(tenant,printer_id,dedupe_key),
 FOREIGN KEY(tenant,printer_id) REFERENCES printer_devices(tenant,id)
);
CREATE INDEX IF NOT EXISTS printer_jobs_pending ON printer_jobs(tenant,printer_id,state,created_at);
CREATE TABLE IF NOT EXISTS printer_audit (
 id INTEGER PRIMARY KEY, tenant TEXT NOT NULL, printer_id TEXT NOT NULL, job_id TEXT,
 action TEXT NOT NULL, created_at INTEGER NOT NULL
);
