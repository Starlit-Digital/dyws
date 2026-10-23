CREATE TABLE IF NOT EXISTS drivers (
 tenant TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL,
 password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 PRIMARY KEY(tenant,id)
);
CREATE TABLE IF NOT EXISTS admin_credentials (tenant TEXT PRIMARY KEY, password_hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS account_migrations (tenant TEXT PRIMARY KEY, completed_at INTEGER NOT NULL);
