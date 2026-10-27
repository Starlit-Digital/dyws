# HTTP API

Entry point: `/diner-demo/api/?route=/health`. Routes below are values of the `route` query parameter, not separate rewritten paths. Send JSON for POST requests. Responses use JSON, no store caching and meaningful 4xx status codes. Request body limit: 32 KiB. State is scoped to the configured business tenant. The current application release is recorded in [VERSION](../VERSION).

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| GET | /health | Public | Service and demo status |
| POST | /pickup/preview | Public, rate limited | Validate scheduled pickup and return fulfillment metadata |
| POST | /login | Public, rate limited | Manager or driver session |
| POST | /logout | Bearer | Revoke current session |
| POST | /orders | Public, rate limited | Create idempotent test order |
| GET | /tracking/ORDER_ID | X-Tracking-Token | Customer status, saved receipt, public business details and current GPS |
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
  "addressDetails": {"line1": "123 Example Avenue NW", "line2": "Unit 4"},
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

## Catalog and optional payment endpoints

The Stripe routes below are compatibility references for a separately installed plugin. They are absent from the standard kit, which includes no Stripe implementation or SDK.

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

Checkout collects street address, optional unit and optional postal code in addressDetails: {line1, line2, postalCode}. Only line1 is required. The API also accepts optional city, region, postalCode and country for integrations and existing full addresses, and normalizes omitted fields to empty strings. A supplied Canadian postal code is validated when country is CA or Canada. The backend assembles address, persists addressDetails and keeps older freeform address requests working. Authorized tracking responses include deliveryAddress so the customer can view their own destination and route. Driver locations include the assigned deliveryAddress for admin routing.

GET /driver/gps-config requires driver authentication. It returns testLocation only when a private deployment explicitly configures a test origin. In this mode, authenticated driver order reads renew the simulated fix for assigned active deliveries. No anonymous endpoint publishes a simulated point or driver coordinates.

## Account storage

dyws stores driver records and admin password hashes in the same private SQLite database as orders. HTTP request and response contracts are unchanged. Credential changes and session revocation commit in the same transaction. Each tenant imports legacy account configuration only once. Business settings, map settings, encrypted Stripe configuration and product catalogs remain private JSON.

## Plugins

GET /plugins returns apiVersion 1 and active compatible browser plugin metadata, with no configuration or credentials. GET /manager/plugins requires manager authentication and returns installed metadata, activation state, load errors and a revision. POST /manager/plugins accepts id, active boolean and revision; it requires manager authentication and rejects stale revisions with 409. State remains private JSON, scoped by tenant.

Active plugin routes are dispatched after core routes. Core enforces the route's public, manager or driver access before calling it. Google Maps now uses GET /plugins/google-maps/config and manager authenticated GET/POST /manager/plugins/google-maps/settings. Existing Maps aliases work only while the plugin is active. Inactive plugin routes return 404. Plugin POST mutations notify operator and public subscriptions; no keys or location payloads are put in invalidation messages. See plugins.md for lifecycle and hook contracts.

## Plugins and payment providers

Stripe endpoints exist only when the separate Stripe plugin is installed. The public kit does not register them. Use GET/POST /manager/plugins/stripe/settings, POST /manager/plugins/stripe/verify, POST /plugins/stripe/orders/{id}/checkout and POST /plugins/stripe/webhook. Manager settings require a bearer token, Checkout requires the order tracking token, and webhooks require the original raw body and valid Stripe signature. Existing Stripe URLs remain aliases. Deactivation disables new checkout, retains signed webhook processing for in flight payments, and preserves encrypted settings. The ledger and reporting stay available independently.

GET /plugins also returns hooks, the 37 hook descriptions. GET /manager/lookup?q=...&kind=all supports manager only search, with products, orders and drivers as native kinds and lookup.results for plugin kinds. Query length is 1 to 100 bytes. Results are bounded and tenant scoped.

POST /orders accepts an optional pluginData object keyed by installed plugin convention. Values are objects or arrays, up to 20 keys and 8192 encoded bytes in total. Plugins validate their own data with order.validating. Values participate in idempotency and remain in SQLite; authorised manager and driver order projections include pluginData, while public tracking omits it by default. Unknown plugin data does not execute code or create a capability.

See [the hook reference](plugin-hooks.md) for validation timing and response filters. Core pricing, manager authorization, driver assignment, tracking tokens and online payment guards run before relevant plugin hooks.

## Order Reporting

Manager only GET /manager/plugins/order-reporting/dashboard accepts from, to, currency and fulfillment. It returns a schemaVersion 1 aggregate with current metrics, previous period metrics, daily series, item totals, status, fulfilment and hourly counts. It excludes customer contact and location data. See [report definitions](order-reporting.md). The existing /manager/reports adds orderReporting when the plugin is active. Disabling the plugin leaves core reports available. DataTables has no API routes or server data access.

## Timezone preferences

`GET /settings` includes `timeZone`, a validated IANA timezone identifier. `GET /manager/settings` returns `{settings, revision, timeZones}` with the server supported selector choices. `POST /manager/settings` accepts `{revision, settings: {driverRole, timeZone}}`, uses the existing revision conflict protection and returns the same shape. Manager authorization is required. Invalid identifiers, offsets, arrays and null values return 422. Older clients that omit timeZone preserve its saved value. Legacy settings default to America/Edmonton without rewriting the settings file.

Successful API responses include `X-DYWS-Time-Zone`. The optional WebSocket relay forwards the same value as response timeZone metadata. The JavaScript client applies it to its shared display formatter on each response, so open polling pages adopt changes on their next update. Public settings expose only the chosen zone, not the entire selector list. PHP runtime uses UTC; database timestamps remain Unix seconds. GPS and route browser calculations retain their documented millisecond values. Never reinterpret or migrate stored instants when changing this display preference.

Business details are edited from Settings using the existing manager catalog API. Business name, ordering system name, pickup address, phone, email, Item Order Cap, tax rate and delivery fee remain catalog fields; currency is read only. The editor submits the loaded catalog revision and preserves categories and items. A concurrent catalog or business edit returns 409 rather than overwriting another edit. General display preferences continue to use the separate settings JSON API.

Browser administration starts at `/admin/`, with a standalone `/auth/` form and server checked page access. Page cookies do not authorize API calls. API clients continue to use bearer tokens, including WebSocket requests.

## Hosted public demo policy

The hosted `/diner-demo/` installation additionally requires `username: "admin"` with the manager login. Driver login uses `driverId: "driver"`. Both public passwords match their identifiers. This behavior belongs to Installation Lockdown, not the normal authentication contract. Critical mutations, payment callbacks, integration reads and unknown endpoints return 403 even with the public manager token. Order contacts, delivery address, notes and plugin data are normalized to fictional values before storage. See [Installation Lockdown](demo-lockdown.md).


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

Public tracking adds nullable `deliveryRun: {stopsAhead, isNext}` only while that order remains on an active run. It exposes no run IDs, other orders, addresses or contacts. Run location endpoints require both driver authentication and the current sharing token. Configured test coordinates override client coordinates just as they do for individual deliveries. Lease expiry, logout and delivery completion retain the existing GPS cleanup rules. The public Installation Lockdown plugin does not allow these new mutation endpoints yet.

Drivers edit their own vehicle model (`vehicleType`) and colour (`vehicleColor`) through `POST /driver/profile`. The model is optional text, up to 60 bytes. Colours use the 32 named choices in `AdminAccounts::VEHICLE_COLORS`. Omitted fields retain saved values; empty strings clear them. An unchanged legacy free text colour can be retained until its owner chooses a replacement. The manager driver listing includes both fields, but manager account saves preserve the saved vehicle details and ignore submitted replacements. Changing display details preserves existing sessions and credentials.

Private tracking responses include `driver: {name, vehicleType, vehicleColor, profileIcon}` for an assigned delivery, or `null` for an unassigned order, pickup or cancellation. Profiles are looked up within the order tenant only after tracking authorization. No driver login IDs, credentials or contact details are included. Driver edits invalidate live tracking views.

## Customer tracking receipt

The token protected tracking response also includes `createdAt` as UTC seconds, `business: {name, phone, pickupAddress}` and `summary: {lines, currency, subtotal, tax, deliveryFee, tip, total}`. Summary amounts are saved integer cents. Each line exposes only `name`, `option`, `quantity` and `price`; changing the catalog never rewrites an existing receipt. Tenant, token and expiry checks apply before these fields are returned. Customer names, phone numbers, notes, credentials and plugin order data are not added to the response. The existing delivery address remains available only through the authorized tracking response.

Checkout makes no order creation request during the final review. The ten second countdown or an explicit Place order click submits the reviewed order once. Back and closing the dialog cancel the timer. Taking more time or hiding the page pauses it until the customer deliberately confirms. Submission failures retain the cart and reuse the existing idempotency key when the order is unchanged.

## Order Format templates

These endpoints exist only while Order Format is active:

| Endpoint | Access | Contract |
| --- | --- | --- |
| `GET /plugins/order-format/layouts` | Public | `{layouts: {cart?: layout, checkout?: layout, review?: layout}}`. Only assigned layouts, without template names, drafts or revisions. Empty or corrupt settings return no layouts, selecting built in defaults. |
| `GET /manager/plugins/order-format/templates` | Manager | `{templates, assignments, schema, revision}`. Schema lists stage labels, field IDs and essential fields. |
| `POST /manager/plugins/order-format/templates` | Manager | Replace `{templates, assignments, revision}`, maximum 65536 bytes. Returns the current manager projection. |

Each template is `{id, name, stage, layout}`. IDs contain 1 to 64 ASCII letters, digits or hyphens; names are nonempty and at most 80 bytes. Stage is `cart`, `checkout` or `review`. Layout contains `rows` and `fields`, each with `id`, `row`, `column`, `span`, `align` and `vertical`. See [Order Format](order-format.md) for placement limits and required controls. At most 30 templates are accepted. Assignments map each stage to a saved template of that same stage, or `null` for its built in default. Saving an unassigned draft alone has no storefront effect.

Stale revisions return 409. Invalid, overlapping or incomplete layouts return 422. Unreadable settings return 503 to managers while the public projection falls back safely. Deactivation removes the routes and preserves the private tenant file. The public demo permits reads but rejects template writes with 403, including authenticated manager writes.

## Payment connector settings

Each active payment connector exposes manager only GET and POST `/manager/plugins/ID/settings` and POST `/manager/plugins/ID/verify`. Settings return safe field definitions and saved flags, never credential values. Writes require a revision and accept sandbox credentials plus explicit fields to clear. Verification runs a provider specific sandbox check. The response explicitly distinguishes connector readiness from checkout availability. See [complete contracts](payment-connectors.md) for fields, event routes and trusted server operations. No arbitrary provider request endpoint or customer payment capture API is exposed.

The manager plugin listing also returns `type`, and active connector records include safe `connection` state. Activating a connector does not select it as the order payment provider.

## Business locations, October 24, 2026

Catalogs may contain `locations`, up to 50 rows with stable `id`, required `name` and `address`, optional `phone`, and boolean `active`. Business details saves this list through the existing revision checked catalog endpoint. Omitting locations retains the single pickup address behaviour.

Order creation accepts `locationId`. A catalog with multiple available locations requires a selection. A sole active location is selected by default when the field is omitted. Unknown and inactive locations are rejected. The server resolves the location from its own catalog and ignores a submitted `orderLocation` object. The location ID participates in the order fingerprint, so a reused request key cannot switch branches.

New orders save a location snapshot in `orders.order_location_json`. Authenticated order results and private tracking return `orderLocation` with `id`, `name`, `address` and `phone`. The existing tracking `location` field still means driver GPS. Renaming, disabling or removing a branch preserves existing order pickup details and valid retries. Older orders without a snapshot use the business pickup address. Checkout and review pickup address links open Google Maps in a separate tab.

## Driver profiles

Authenticated drivers read `GET /driver/profile` and save `POST /driver/profile` with `profileIcon`, optional `vehicleType` and `vehicleColor`, and the current `revision`. All supplied display details save atomically. The supported values are `car`, `suv`, `pickup`, `van`, `motorcycle` and `bicycle`. Car is the default. The server selects the account from the authenticated session; submitted IDs, names, passwords and activity fields cannot change an account through this endpoint. Stale revisions return 409 and unsupported icons or new colours return 422. Managers use their existing driver editor contract, which preserves an omitted icon.

`/driver/orders` includes the signed in driver's safe `profile`. Manager driver summaries, the manager order board's driver list and private customer tracking expose `profileIcon` for rendering. No credentials are included. Changes notify active operator and tracking views. This is an appearance preference and does not change routing mode or location sharing.

## Address suggestions

The optional Nominatim plugin provides `/plugins/nominatim/config`,
`/plugins/nominatim/search` and manager settings under
`/manager/plugins/nominatim/settings`. See [the plugin contract](nominatim.md).
Searches never create orders or establish delivery eligibility.

## Order Printer

The optional `order-printer` plugin provides manager configuration and separately authenticated device enrollment, polling and acknowledgement routes. See [the complete route and queue contract](order-printer.md#api-and-queue-contract). Device tokens use `X-DYWS-Printer-Token`; manager sessions cannot substitute for them.


## Remembered guest details

`GET /guest-details` returns `{profileId: null, addresses: []}` for a browser without valid saved details. Otherwise it returns `profileId`, `customer: {name, phone}`, `defaultAddressId`, `expiresAt` (Unix seconds) and `addresses: [{id, label, addressDetails}]`. Reads never renew expiry and never set an access cookie before consent.

`POST /guest-details` accepts one of:

```json
{"action":"remove","addressId":"ADDRESS_ID"}
{"action":"default","addressId":"ADDRESS_ID"}
{"action":"forget"}
```

Removal and default changes are limited to the current cookie's business and profile. Forget removes the profile and its addresses and expires the access cookie. Order records are separate. No name or phone search can retrieve an address book. Responses use `Cache-Control: no-store`.

Both routes require `X-DYWS-Guest: 1`. Guest writes also reject a foreign `Origin` or `Sec-Fetch-Site: cross-site`. The API does not grant CORS access. Use the HTTP client with `{guest: true}`; these requests bypass the WebSocket relay so the browser can send and receive its cookie directly. This feature is intended for the business's own website and API on the same origin.

The standard storefront passes the same option on order submission. `POST /orders` accepts an optional `rememberDetails` object:

```json
{
  "enabled": true,
  "profileId": "",
  "addressId": "",
  "label": "Home",
  "default": true
}
```

Use the current profile and address IDs when editing a saved entry. Empty IDs indicate new consent or a new address. Labels are at most 40 bytes; up to ten addresses are allowed. Only the committed order's validated contact and structured delivery address are copied. New saves reuse identical structured addresses. Selecting another address never submits an order.

Each newly created order through the guest HTTP flow extends an existing profile to the order creation time plus 180 days (15,552,000 seconds), including pickup orders and orders with `enabled: false`. False stops new details being saved; Forget revokes the feature. Unsuccessful orders, browsing, management actions and idempotent retries do not renew expiry. Saving and order creation share a transaction. A stale profile or address ID cannot recreate forgotten or removed details.

The access cookie contains only a random 256 bit capability. SQLite stores its SHA-256 hash. Cookie names include the business and installation path, cookies are HttpOnly and SameSite=Lax, and HTTPS installations use Secure. The capability authorizes saved details only, never tracking, payments, or operator actions. Expired profiles are inaccessible immediately and cascade delete their addresses when cleanup runs.

`mountStorefront({termsURL, ...})` enables the saved details UI and injects the terms link. Hosts may instead set `terms-url` on the ordering element. Custom `submitOrder` adapters must pass `order.rememberDetails` and use the HTTP API option `{guest: true}`. Include a clear Terms and Conditions link and explain removal and shared browser access. The supplied storefront uses `terms/`.

## Business operating policy, October 26, 2026

The manager catalog retains `deliveryFee` in integer cents and adds `deliveryFeeBasisPoints`, an integer from 0 through 10000. The fee is `deliveryFee + floor((subtotal * deliveryFeeBasisPoints + 5000) / 10000)` for delivery, and zero for pickup. Each location optionally supplies `deliveryPricing: {flatFee, basisPoints}`; null inherits the business default. Flat fees range from 0 through 100000 cents.

The catalog and each location accept independent `locationHours` and `orderingHours`. Null at the business level means unrestricted or unpublished. Null at a location means inherit the business default. A schedule has this shape:

```json
{"enabled":true,"days":[
  {"mode":"hours","open":"09:00","close":"17:00"},
  {"mode":"hours","open":"09:00","close":"17:00"},
  {"mode":"hours","open":"09:00","close":"17:00"},
  {"mode":"hours","open":"09:00","close":"17:00"},
  {"mode":"hours","open":"09:00","close":"22:00"},
  {"mode":"allDay","open":"09:00","close":"17:00"},
  {"mode":"closed","open":"09:00","close":"17:00"}
]}
```

Exactly seven entries are required, Monday first. Times use `HH:mm`. Disabled schedules keep their saved days but impose no restriction. `locationHours` is informational. New order creation checks `orderingHours` using the saved timezone and returns 409 when closed. Overnight periods carry into the following day. See [operating semantics](business-operations.md).

Public catalog responses include derived `timeZone` and `acceptingOrders` fields. These are not catalog writable fields. Public and manager settings include `acceptingOrders`, default true. `POST /manager/ordering` accepts `{acceptingOrders: boolean, revision: string}` and returns the normal manager settings summary. Stale revisions return 409. Drivers and anonymous clients cannot modify it. The general settings API preserves omitted fields. Pausing blocks new orders with 409; saved order retries remain idempotent.

## Report downloads and email

Active Order Reporting installations expose these manager only routes:

* `GET /manager/plugins/order-reporting/export-options`: available section names and email availability, saved recipient and setup reason.
* `POST /manager/plugins/order-reporting/export`: body contains `format` (`pdf`, `csv`, `txt`), `sections` (one or more of `overview`, `daily`, `items`, `locations`, `operations`) and `query` (`from`, `to`, `currency`, `fulfillment`). Returns `{name,type,encoding:"base64",content}`. All figures are generated from the server scoped report. Limit: 30 requests per hour per requester.
* `POST /manager/plugins/order-reporting/email`: same report selection plus `idempotencyKey`, 16 through 80 letters, numbers or hyphens. The destination is always the saved business email, never a request supplied address. Limit: five requests per hour per requester. Returns `accepted`, `recipient` and an honest transport status. An accepted submission does not confirm inbox delivery.

Email requests retain a tenant scoped key, fingerprint and status for 30 days. An uncertain or failed attempt is not automatically resent. Accepted retries return the original success without another email. Changing a selection or destination with the same key returns 409. No customer contacts are included in report data or attachments. Email is unavailable until the host mail sender is configured. Public demo visitors may download aggregate reports but cannot send email or change operating settings.


## Optional tips, October 27, 2026

`POST /orders` accepts `tip`, an integer number of cents divisible by 100.
Omission means zero. Negative, fractional, string, boolean, null and out of range
values return 422. The storage safety limit is 99,999,900 cents. The browser
accepts up to six digits of whole dollars through an Add tip button and an
`inputmode="numeric"` field. No amount is preselected. Unchecking excludes the tip.
The choice stays in the page's checkout draft across Back and dialog reopen,
then clears on success or page reload. It is never saved with guest details.

The server calculates `total = subtotal + deliveryFee + tax + tip`. The configured
tax base remains subtotal plus delivery fee. Client totals are ignored. A positive
tip participates in the canonical idempotency fingerprint. Omitted and zero tips
share the existing fingerprint format, preserving retries of old orders.
The order receipt, authorized order projections and tracking `summary` expose
`tip` separately. Existing records migrate to zero without changing their total.

`GET /driver/profile` and the profile in `GET /driver/orders` include read only
`tips: {timeZone, currencies, recentOrders}`. Each currency group contains
`periods: {today, week, month, year, allTime}` and complete retained `daily`,
`weekly` and `monthly` series. Each bucket has integer cent `gross`, `refunded`
and `net`, plus the number of tipped deliveries. Weeks start Monday. The most
recent 50 tipped deliveries include `id`, `currency`, `earnedAt`, `tip`,
`refundedTip` and `netTip`, without customer contacts. Totals and historical
series are not limited to the 200 order board rows or 50 recent deliveries.

Earnings count captured, delivered orders assigned to the authenticated driver.
They use the first delivered event time, falling back to the saved update time
only for legacy records without that event. Assignment cannot change after
starting delivery. Pending, cancelled, pickup and other drivers' orders do not
contribute. Later refunds restate retained earnings in the delivery period;
these figures are not payout records. Profile revisions remain based only on
editable display fields, so earnings changes do not cause save conflicts.

`GET /manager/drivers` includes `tipTotals` per driver, grouped by currency with
the same period definitions. Manager reports expose `orderedTips`, `capturedTips`,
`refundedTips` and `netTips`. See the reporting definitions for order versus
payment dates. Public demo history still expires under its existing 24 hour rule.
## Pickup scheduling and fulfillment metadata

`POST /pickup/preview` accepts `{locationId, pickupSchedule: {date, time}}`, where
`date` is `YYYY-MM-DD` and `time` is `HH:mm`, using hours 00 through 23 and minutes
00, 15, 30 or 45. The public endpoint checks the selected active location, its
open hours and a minimum of 30 minutes from the server clock. It creates no order
and is limited to 60 requests per minute per request bucket. Checkout calls it
before review so future time zone differences between browsers and the server
cannot change the displayed UTC instant. Host adapters using the ordering
component directly must provide `ordering.pickupAPI`, with the same signature as
the ordinary API client. `mountStorefront` supplies it automatically.

Pass the same optional `pickupSchedule` to `POST /orders`. Omit it or use null for
ordinary pickup. Scheduling is rejected for delivery orders. Invalid dates,
nonexistent and repeated local clock times, closed locations and times less than
30 minutes ahead return 422. Online ordering must also be enabled and open when
the order is submitted. Disabled location hours impose no pickup hours limit.
Opening periods that cross midnight include their following morning. A retry
with an existing request key returns the original receipt without reapplying
current clock, availability or time zone settings. Changing the requested date
or time with the same key returns 409.

Every new order stores `fulfillmentMeta` version 1, generated by the server.
The receipt, scoped customer tracking, manager orders, status responses and
printer job responses expose it. Caller supplied metadata is ignored.

```json
{
  "version": 1,
  "type": "scheduled_pickup",
  "label": "Scheduled pickup",
  "scheduled": true,
  "scheduledAt": 1894037400,
  "scheduledAtUtc": "2030-01-07T17:30:00Z",
  "localDate": "2030-01-07",
  "localTime": "12:30",
  "timeZone": "America/New_York",
  "locationId": "north"
}
```

`type` is `pickup`, `scheduled_pickup` or `delivery`. The original `fulfillment`
field remains `pickup` or `delivery` for workflow compatibility. Unscheduled
orders have `scheduled: false` and null schedule fields. The time zone is an
immutable business setting snapshot. Legacy orders have a null time zone,
because their historical zone was never recorded. Consumers should use `type`
and the schedule fields rather than parsing labels or notes. UTC timestamps are
seconds, not milliseconds. Version 1 does not schedule deliveries or kitchen
preparation automatically.

Customer review, tracking and operator markup include `data-order-type`, and
scheduled orders add `data-pickup-date`, `data-pickup-time`,
`data-pickup-time-zone`, `data-pickup-at` and a `<time datetime="…">` element.
These describe the same saved record for future website or email renderers.
No new order email sender is installed. Order hooks can read `fulfillmentMeta`
from the receipt or safe order. Customer details and tracking access remain
private. Starting addresses used for pickup directions are not saved to orders
or remembered guest profiles.

The printer poll job adds `orderId` and `fulfillmentMeta` (null for printer test
jobs). Tickets clearly label `SCHEDULED PICKUP`, `PICKUP` or `DELIVERY`. Scheduled
tickets print the pickup date, time and zone separately from the placed time.
Existing acceptance and printer queue rules still apply, so a scheduled ticket
prints when eligible rather than waiting until pickup time. Tracking links for
scheduled orders expire 24 hours after pickup time. Locked public demos still
delete all fictional orders 24 hours after creation.

## Customer cancellation

Catalog and location objects accept `customerCancellation: {enabled: false,
minutes: 4}`. Minutes must be an integer from 1 to 1440. Locations have independent
policies. With no locations, the business policy applies. Missing policies are
disabled. Manager catalog saves keep the existing revision check.

Each new order snapshots `cancellation_window_minutes`. Later settings changes do
not change its deadline. Existing orders migrate with cancellation disabled.
Tracking returns `cancellation: {enabled, minutes, deadline, serverTime, available,
cancelledAt, paymentState, refundAmount, fee}`. Times are Unix seconds. The deadline
is exclusive and measured from order creation. Availability also requires placed,
accepted, preparing or ready status. `refundAmount` is the entire saved total,
including tip, and `fee` is zero. Provider fees paid by the business are not a
customer deduction. Admin orders include the same summary without `serverTime`.

`POST /tracking/ORDER_ID/cancel`, with an empty JSON body and the existing
`X-Tracking-Token`, cancels an eligible order. It returns current tracking data.
Missing, incorrect, expired or foreign capabilities return 404. Closed windows
and orders already collected or dispatched return 409. The server checks all
conditions inside the transaction. Repeated requests for a customer cancelled
order return its current state without another refund. Required status validators
still run. A planned delivery run loses only the cancelled order, with remaining
stop positions and revision updated. Active runs cannot be cancelled this way.

Cancellation commits before provider work. Payment states are `pending`,
`refund_pending`, `attention`, `refunded` and `not_charged`. Only the verified
payment ledger confirms `refunded`. Provider outages retain a durable job and
show a delay, without restoring the cancelled order or claiming a refund completed.
The demo ledger records one full fictional refund when a captured order is
cancelled. Existing reporting and tip allocation include the same refund exactly
once. Customer actions are recorded with actor `customer`.
