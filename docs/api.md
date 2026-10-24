# HTTP API

Entry point: `/diner-demo/api/?route=/health`. Routes below are values of the `route` query parameter, not separate rewritten paths. Send JSON for POST requests. Responses use JSON, no store caching and meaningful 4xx status codes. Request body limit: 32 KiB. State is scoped to the configured business tenant. The current application release is recorded in [VERSION](../VERSION).

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| GET | /health | Public | Service and demo status |
| POST | /login | Public, rate limited | Manager or driver session |
| POST | /logout | Bearer | Revoke current session |
| POST | /orders | Public, rate limited | Create idempotent test order |
| GET | /tracking/ORDER_ID | X-Tracking-Token | Minimal customer status and current GPS |
| GET | /manager/orders | Manager bearer | Up to 200 orders, active before finished, and configured drivers |
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
  "addressDetails": {"line1": "123 Example Avenue NW", "line2": "", "city": "Edmonton", "region": "AB", "postalCode": "T5A 1A1", "country": "CA"},
  "notes": "Test only",
  "lines": [{"id": "breakfast0", "variant": "", "quantity": 1}]
}
```

Response: `{id, demo, total, paymentProvider, currency, trackingToken}`. Values are integer cents. A duplicate request with the same key returns the existing order. A different canonical order with that key receives 409. Duplicate item and variant lines are rejected; combine their quantities. The server ignores prices and totals provided by the browser.

Status body: `{status: "accepted"}`. See architecture.md for allowed transitions.

Assignment body: `{driverId: "demo-driver"}`. Assignment is limited to nonterminal delivery orders before pickup. Changing an active driver is intentionally unavailable in this prototype.

Payment body: `{kind: "capture"}` or `{kind: "refund"}`. This only creates a test record; it never charges or refunds money.

Location body:

```json
{"latitude": 53.61665, "longitude": -113.39804, "accuracy": 8, "recordedAt": 1792743300, "sharingToken": "token from location/start"}
```

Use the measurement timestamp from GeolocationPosition.timestamp divided by 1000, not a replacement timestamp or the example value. First POST /driver/orders/ORDER_ID/location/start with {source: "device"}; retain its sharingToken in memory and include it in uploads. POST /driver/orders/ORDER_ID/location/stop with that sharingToken to end capture. These routes require the assigned driver bearer session and an active delivery. Source "simulated" is reserved for test harnesses and is explicitly labelled in customer and admin views. POST /driver/orders/ORDER_ID/location/heartbeat with the same token keeps an active authenticated sharing session alive without updating its measurement timestamp. Sharing expires after two minutes without an upload or heartbeat. Accuracy is metres. Only the assigned out for delivery order accepts positions. Updates more than three minutes old, more than 30 seconds in the future, or not newer than the last accepted position are rejected.

Reports use separate `from` and `to` query parameters, both `YYYY-MM-DD`. The inclusive date range is interpreted in the timezone selected in Settings (America/Edmonton by default), up to one year. Responses include the applied Unix boundaries, currency, operational metrics, signed test payment totals, status counts and top items. See architecture.md for metric definitions.

No CORS wildcard is provided. The existing example operates on the same origin. Future website integrations should use a narrowly configured origin policy and restaurant scoped public credentials with server side enforcement.

## Catalog and Stripe endpoints

| Method | Route | Access |
| --- | --- | --- |
| GET | /catalog | Public active product catalog |
| GET, POST | /manager/catalog | Manager, save `{catalog, revision}` with revision from GET |
| GET, POST | /manager/plugins/stripe/settings | Manager, redacted summary or write `{apiKey, webhookSecret, enabled}` |
| POST | /manager/plugins/stripe/verify | Manager, checks saved sandbox key |
| POST | /plugins/stripe/orders/{orderId}/checkout | Order tracking token in X-Tracking-Token header |
| POST | /plugins/stripe/webhook | Stripe signature over the raw JSON request |

Order receipts include paymentProvider and currency. Tracking adds paymentProvider and checkoutStatus. Stripe order payments are webhook controlled. See catalog-and-payments.md for schema and reconciliation rules.

## Administration accounts

All three endpoints require a manager bearer session. Driver sessions receive 403 and anonymous requests receive 401. Account hashes and passwords are never returned.

* GET /manager/drivers returns drivers with id, name, active, activeOrders, and an opaque revision.
* POST /manager/drivers accepts id, name, active, password and the loaded revision. A new driver needs a password. A blank password on an existing driver keeps the old one. IDs remain stable. A stale revision returns 409. Deactivation is reversible and is blocked while the driver has unfinished assigned orders. Password resets and deactivation revoke that driver's sessions. Inactive drivers cannot sign in or receive new assignments.
* POST /manager/password accepts currentPassword, newPassword and confirmPassword. The current password must verify. Success returns ok and signInRequired, and revokes all manager sessions. New passwords are limited to 12 through 72 bytes, with the browser also enforcing at least 12 characters. No existing credentials are changed by deployment.

Account records and password hashes are stored in SQLite. Credential changes and session revocation commit together; file locking serializes login, updates and assignment eligibility checks. Passwords use PHP password_hash. Account changes and password attempts are rate limited. Back up the database and private configuration together. Older JSON credentials are imported once per tenant; current account writes do not update JSON.

## General settings

`GET /settings` returns public role labels and the display timezone: `{"driverRole":{"singular":"Driver","plural":"Drivers"},"timeZone":"America/Edmonton"}`. `GET /manager/settings` requires a manager session and returns `{settings, revision, timeZones}`. `POST /manager/settings` accepts `{settings, revision}`. Both names are required, with up to 60 characters and no control characters. A stale revision returns 409.

Settings are private tenant scoped JSON, updated atomically under a file lock. No credential fields are accepted or returned. Display names never alter the internal `driver` role, API paths, account IDs or permissions. A role displayed as Admin still cannot access manager endpoints.

## Maps and realtime

GET /plugins/google-maps/config exposes only the enabled browser map configuration. GET /manager/plugins/google-maps/settings requires manager authentication and returns enabled, hasKey, mapId and revision. POST accepts enabled, browserKey, mapId and revision. Blank key retains the saved value. A stale revision is 409; enabling without a key is rejected. The private maps JSON is tenant scoped and mode 0600. See gps-maps-realtime.md for restrictions and caching.

GET /realtime/config returns the optional public WebSocket URL and fallback: polling. POST /realtime/access takes scope public, operator or tracking, with orderId for tracking. Operator uses bearer authentication; tracking uses X-Tracking-Token. The result includes authorized channels, revision and expiresAt. This grants notifications only; data requests still require their normal credentials. Notifications contain no order or GPS data.

Manager and driver order responses include gps: {sharing, source, recordedAt, accuracy, stale, location}. Public tracking adds locationSource and retains its existing location and gpsStale fields. Demo checkout navigates to `tracking/#ORDER_ID.TOKEN`. A local script POSTs the credentials to PHP, which verifies them, sets an order scoped HttpOnly cookie and redirects to `tracking/?order=ORDER_ID`. The token stays out of request URLs and referrer headers; JavaScript API reads use X-Tracking-Token.

GET /manager/driver-locations requires manager authentication and returns active delivery entries containing driverId, orderId and gps. It powers the per driver map cards without returning customer contact details.

Full checkout addresses may use addressDetails: {line1, line2, city, region, postalCode, country}. All fields except line2 are required for this shape. Canadian postal codes are validated. The backend assembles address, persists addressDetails and keeps older freeform address requests working. Authorized tracking responses include deliveryAddress so the customer can view their own destination and route. Driver locations include the assigned deliveryAddress for admin routing.

GET /driver/gps-config requires driver authentication. It returns testLocation only when a private deployment explicitly configures a test origin. In this mode, authenticated driver order reads renew the simulated fix for assigned active deliveries. No anonymous endpoint publishes a simulated point or driver coordinates.

## Account storage

dyws stores driver records and admin password hashes in the same private SQLite database as orders. HTTP request and response contracts are unchanged. Credential changes and session revocation commit in the same transaction. Each tenant imports legacy account configuration only once. Business settings, map settings, encrypted Stripe configuration and product catalogs remain private JSON.

## Plugins

GET /plugins returns apiVersion 1 and active compatible browser plugin metadata, with no configuration or credentials. GET /manager/plugins requires manager authentication and returns installed metadata, activation state, load errors and a revision. POST /manager/plugins accepts id, active boolean and revision; it requires manager authentication and rejects stale revisions with 409. State remains private JSON, scoped by tenant.

Active plugin routes are dispatched after core routes. Core enforces the route's public, manager or driver access before calling it. Google Maps now uses GET /plugins/google-maps/config and manager authenticated GET/POST /manager/plugins/google-maps/settings. Existing Maps aliases work only while the plugin is active. Inactive plugin routes return 404. Plugin POST mutations notify operator and public subscriptions; no keys or location payloads are put in invalidation messages. See plugins.md for lifecycle and hook contracts.

## Plugins and payment providers

Stripe endpoints are registered by the bundled plugin. Use GET/POST /manager/plugins/stripe/settings, POST /manager/plugins/stripe/verify, POST /plugins/stripe/orders/{id}/checkout and POST /plugins/stripe/webhook. Manager settings require a bearer token, Checkout requires the order tracking token, and webhooks require the original raw body and valid Stripe signature. Existing Stripe URLs remain aliases. Deactivation disables new checkout, retains signed webhook processing for in flight payments, and preserves encrypted settings. The ledger and reporting stay available independently.

GET /plugins also returns hooks, the 37 hook descriptions. GET /manager/lookup?q=...&kind=all supports manager only search, with products, orders and drivers as native kinds and lookup.results for plugin kinds. Query length is 1 to 100 bytes. Results are bounded and tenant scoped.

POST /orders accepts an optional pluginData object keyed by installed plugin convention. Values are objects or arrays, up to 20 keys and 8192 encoded bytes in total. Plugins validate their own data with order.validating. Values participate in idempotency and remain in SQLite; authorised manager and driver order projections include pluginData, while public tracking omits it by default. Unknown plugin data does not execute code or create a capability.

See [the hook reference](plugin-hooks.md) for validation timing and response filters. Core pricing, manager authorization, driver assignment, tracking tokens and online payment guards run before relevant plugin hooks.

## Order Reporting

Manager only GET /manager/plugins/order-reporting/dashboard accepts from, to, currency and fulfillment. It returns a schemaVersion 1 aggregate with current metrics, previous period metrics, daily series, item totals, status, fulfilment and hourly counts. It excludes customer contact and location data. See [report definitions](order-reporting.md). The existing /manager/reports adds orderReporting when the plugin is active. Disabling the plugin leaves core reports available. DataTables has no API routes or server data access.

## Timezone preferences

`GET /settings` includes `timeZone`, a validated IANA timezone identifier. `GET /manager/settings` returns `{settings, revision, timeZones}` with the server supported selector choices. `POST /manager/settings` accepts `{revision, settings: {driverRole, timeZone}}`, uses the existing revision conflict protection and returns the same shape. Manager authorization is required. Invalid identifiers, offsets, arrays and null values return 422. Older clients that omit timeZone preserve its saved value. Legacy settings default to America/Edmonton without rewriting the settings file.

Successful API responses include `X-DYWS-Time-Zone`. The optional WebSocket relay forwards the same value as response timeZone metadata. The JavaScript client applies it to its shared display formatter on each response, so open polling pages adopt changes on their next update. Public settings expose only the chosen zone, not the entire selector list. PHP runtime uses UTC; database timestamps remain Unix seconds. GPS and route browser calculations retain their documented millisecond values. Never reinterpret or migrate stored instants when changing this display preference.

Business details are edited from Settings using the existing manager catalog API. Business name, ordering system name, pickup address, tax rate and delivery fee remain catalog fields; currency is read only. The editor submits the loaded catalog revision and preserves categories and items. A concurrent catalog or business edit returns 409 rather than overwriting another edit. General display preferences continue to use the separate settings JSON API.

Browser administration starts at `/admin/`, with a standalone `/auth/` form and server checked page access. Page cookies do not authorize API calls. API clients continue to use bearer tokens, including WebSocket requests.

## Hosted public demo policy

The hosted `/diner-demo/` installation additionally requires `username: "admin"` with the manager login. Driver login uses `driverId: "driver"`. Both public passwords match their identifiers. This behavior belongs to Demo Lockdown, not the normal authentication contract. Critical mutations, payment callbacks, integration reads and unknown endpoints return 403 even with the public manager token. Order contacts, delivery address, notes and plugin data are normalized to fictional values before storage. See [Demo Lockdown](demo-lockdown.md).


## Delivery runs

`GET /manager/orders` includes `runs`, the planned and active runs for this tenant. `GET /driver/orders` includes only the authenticated driver's runs. Both remain PHP startup data sources. Authorized order objects include a nullable `deliveryRun` membership with ID, state, driver and stop position.

| Endpoint | Access | Body / behavior |
| --- | --- | --- |
| `POST /manager/runs` | Manager | `driverId`, ordered `orderIds` (1 to 20), `idempotencyKey` (16 to 80 letters, digits or hyphens). Creates and assigns a planned run. Same request key and stops return the original run. |
| `POST /manager/runs/RUN_ID` | Manager | `action: reorder`, current integer `revision`, and the same `orderIds` in the new order; or `action: cancel` with `revision`. Planned runs only. |
| `POST /driver/runs/RUN_ID/start` | Assigned driver | Empty JSON object. Starts all ready, paid stops atomically. Retrying an active run is safe. |
| `POST /driver/runs/RUN_ID/location/start` | Assigned driver | `source: device` or `simulated`. Returns `sharingToken` and `expiresIn: 120`. |
| `POST /driver/runs/RUN_ID/location` | Assigned driver | Same coordinates, accuracy, measurement timestamp and `sharingToken` as the individual delivery endpoint. One upload updates all remaining stops in one transaction. |
| `POST /driver/runs/RUN_ID/location/heartbeat` | Assigned driver | `sharingToken`. Renews remaining leases without redating measurements. |
| `POST /driver/runs/RUN_ID/location/stop` | Assigned driver | `sharingToken`. Ends only matching leases; stale tabs cannot end replacement shares. |

Complete a stop with the existing `POST /driver/orders/ORDER_ID/status`, `status: delivered`. Only the next stop may complete. Completion removes that customer's GPS, advances the run revision and invalidates every affected tracking channel. The last stop completes the run. Existing payment and plugin status validators still apply. Manager status changes obey the same run ordering rules.

One driver may have one planned or active run. An order cannot belong to two open runs. A driver with a standalone delivery already on the road must finish it before a run is created. A planned run must be cancelled before its individual orders can be reassigned or cancelled. Run cancellation keeps each order ready and its driver assignment intact. Stale edits and conflicting assignments return 409; unauthorized drivers receive 403. Run IDs use `RUN-` and twelve uppercase hexadecimal characters.

Public tracking adds nullable `deliveryRun: {stopsAhead, isNext}` only while that order remains on an active run. It exposes no run IDs, other orders, addresses or contacts. Run location endpoints require both driver authentication and the current sharing token. Configured test coordinates override client coordinates just as they do for individual deliveries. Lease expiry, logout and delivery completion retain the existing GPS cleanup rules. The public Demo Lockdown plugin does not allow these new mutation endpoints yet.
