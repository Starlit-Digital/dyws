-- Immutable destinations. Provider IDs and device address book IDs are not identities.
CREATE TABLE IF NOT EXISTS delivery_addresses (
 tenant TEXT NOT NULL, id TEXT NOT NULL, address_key TEXT NOT NULL,
 address_json TEXT NOT NULL, address_text TEXT NOT NULL, created_at INTEGER NOT NULL,
 PRIMARY KEY(tenant,id), UNIQUE(tenant,address_key)
);
CREATE TABLE IF NOT EXISTS customer_delivery_addresses (
 tenant TEXT NOT NULL, customer_id TEXT NOT NULL, address_id TEXT NOT NULL,
 first_used_at INTEGER NOT NULL, last_used_at INTEGER NOT NULL,
 PRIMARY KEY(tenant,customer_id,address_id),
 FOREIGN KEY(tenant,customer_id) REFERENCES customers(tenant,id) ON DELETE CASCADE,
 FOREIGN KEY(tenant,address_id) REFERENCES delivery_addresses(tenant,id)
);
CREATE INDEX IF NOT EXISTS customer_delivery_addresses_recent ON customer_delivery_addresses(tenant,customer_id,last_used_at DESC,address_id);
CREATE INDEX IF NOT EXISTS orders_missing_delivery_address ON orders(tenant,id) WHERE fulfillment='delivery' AND delivery_address_id IS NULL;
CREATE INDEX IF NOT EXISTS guest_missing_delivery_address ON guest_addresses(tenant,profile_id,id) WHERE delivery_address_id IS NULL;
