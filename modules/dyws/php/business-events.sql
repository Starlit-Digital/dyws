CREATE TRIGGER IF NOT EXISTS dyws_business_placed AFTER INSERT ON events WHEN NEW.status='placed' BEGIN
 INSERT INTO business_events(tenant,order_id,kind,source_id,payload_json,created_at)
 SELECT tenant,id,'order.placed',CAST(NEW.id AS TEXT),json_object('customerId',customer_id,'provider',payment_provider,'subtotal',subtotal,'currency',currency),NEW.created_at FROM orders WHERE tenant=NEW.tenant AND id=NEW.order_id;
END;
CREATE TRIGGER IF NOT EXISTS dyws_business_order AFTER UPDATE OF status,payment_status ON orders WHEN OLD.status<>NEW.status OR OLD.payment_status<>NEW.payment_status BEGIN
 INSERT INTO business_events(tenant,order_id,kind,source_id,payload_json,created_at) VALUES(NEW.tenant,NEW.id,'order.state',NEW.id,json_object('status',NEW.status,'paymentStatus',NEW.payment_status),CAST(strftime('%s','now') AS INTEGER));
END;
CREATE TRIGGER IF NOT EXISTS dyws_business_refund AFTER INSERT ON payment_refund_deltas BEGIN
 INSERT INTO business_events(tenant,order_id,kind,source_id,payload_json,created_at) VALUES(NEW.tenant,NEW.order_id,'payment.refund',NEW.event_id,json_object('subtotal',NEW.subtotal,'amount',NEW.amount),NEW.created_at);
END;
CREATE TRIGGER IF NOT EXISTS dyws_business_checkout AFTER UPDATE OF status ON payment_attempts WHEN OLD.status<>NEW.status BEGIN
 INSERT INTO business_events(tenant,order_id,kind,source_id,payload_json,created_at) VALUES(NEW.tenant,NEW.order_id,'payment.checkout',NEW.order_id,json_object('status',NEW.status),CAST(strftime('%s','now') AS INTEGER));
END;
