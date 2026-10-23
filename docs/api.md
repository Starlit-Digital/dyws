# HTTP API

Entry point: `/diner/api/index.php?route=/health`. Routes below are values of the `route` query parameter, not separate rewritten paths. Send JSON for POST requests. Responses use JSON, no store caching and meaningful 4xx status codes. Request body limit: 32 KiB. State is scoped to the configured restaurant tenant.

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| GET | /health | Public | Service and demo status |
| POST | /login | Public, rate limited | Manager or driver session |
| POST | /logout | Bearer | Revoke current session |
| POST | /orders | Public, rate limited | Create idempotent test order |
| GET | /tracking/ORDER_ID | X-Tracking-Token | Minimal customer status and current GPS |
| GET | /manager/orders | Manager bearer | Latest orders and configured drivers |
| GET | /manager/reports | Manager bearer | Date filtered sales and order metrics |
| POST | /manager/orders/ORDER_ID/status | Manager bearer | Transition order |
| POST | /manager/orders/ORDER_ID/assign | Manager bearer | Assign driver |
| POST | /manager/orders/ORDER_ID/payment | Manager bearer | Record test capture or full refund |
| GET | /driver/orders | Driver bearer | Assigned ready and active deliveries |
| POST | /driver/orders/ORDER_ID/status | Driver bearer | Pickup or delivery completion |
| POST | /driver/orders/ORDER_ID/location | Driver bearer | Publish latest GPS |

Manager login: `{role: "manager", password: "…"}`. Driver login adds `role: "driver"` and `driverId`. Subsequent operator requests use `Authorization: Bearer TOKEN`. Tokens expire after eight hours. A driver token cannot read the manager board.

Order body:

```json
{
  "idempotencyKey": "f72ecab0-cb1e-4875-a18d-486897745522",
  "demoAcknowledged": true,
  "customer": {"name": "Test Guest", "phone": "7805550142"},
  "fulfillment": "delivery",
  "address": "15320 Example Lane NW, Edmonton, fictional",
  "notes": "Test only",
  "lines": [{"id": "breakfast0", "variant": "", "quantity": 1}]
}
```

Response: `{id, demo, total, trackingToken}`. Values are integer cents. A duplicate request with the same key returns the existing order. A different canonical order with that key receives 409. Duplicate item and variant lines are rejected; combine their quantities. The server ignores prices and totals provided by the browser.

Status body: `{status: "accepted"}`. See architecture.md for allowed transitions.

Assignment body: `{driverId: "demo-driver"}`. Assignment is limited to nonterminal delivery orders before pickup. Changing an active driver is intentionally unavailable in this prototype.

Payment body: `{kind: "capture"}` or `{kind: "refund"}`. This only creates a test record; it never charges or refunds money.

Location body:

```json
{"latitude": 53.61665, "longitude": -113.39804, "accuracy": 8, "recordedAt": 1792743300}
```

Use the current Unix timestamp, not the example value. Accuracy is metres. Only the assigned out for delivery order accepts positions. Updates more than three minutes old, more than 30 seconds in the future, or not newer than the last accepted position are rejected.

Reports use separate `from` and `to` query parameters, both `YYYY-MM-DD`. The inclusive date range is interpreted in America/Edmonton, up to one year. Responses include the applied Unix boundaries, currency, operational metrics, signed test payment totals, status counts and top items. See architecture.md for metric definitions.

No CORS wildcard is provided. The existing example operates on the same origin. Future website integrations should use a narrowly configured origin policy and restaurant scoped public credentials with server side enforcement.

## Catalog and Stripe endpoints

| Method | Route | Access |
| --- | --- | --- |
| GET | /catalog | Public active product catalog |
| GET, POST | /manager/catalog | Manager, save `{catalog, revision}` with revision from GET |
| GET, POST | /manager/stripe | Manager, redacted summary or write `{apiKey, webhookSecret, enabled}` |
| POST | /manager/stripe/verify | Manager, checks saved sandbox key |
| POST | /orders/SG-ID/checkout | Order tracking token in X-Tracking-Token header |
| POST | /stripe/webhook | Stripe signature over the raw JSON request |

Order receipts include paymentProvider and currency. Tracking adds paymentProvider and checkoutStatus. Stripe order payments are webhook controlled. See catalog-and-payments.md for schema and reconciliation rules.
