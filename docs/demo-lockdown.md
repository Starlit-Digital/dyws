# Public demo lockdown

Installation Lockdown is an optional bundled plugin for disposable public demonstrations. It is inactive on ordinary installs. The public example is https://sltd.ca/diner-demo/ with Admin at `/admin/` and Driver at `/driver/`.

| Login | Identifier | Password |
|---|---|---|
| Admin | admin | admin |
| Driver | driver | driver |

These are intentionally public credentials. Core role checks, assignment scope, CSRF protection, tracking tokens, server pricing, idempotency and status transition rules still apply. Normal installations keep the minimum 12 character password policy. The special CLI seeds these public accounts only in a new isolated database.

## What visitors can try

Visitors can browse, place fictional pickup and delivery orders, use Orders and Reports, assign the demo driver, record test payment entries, create and reorder delivery runs, and complete deliveries in stop order. Run tracking uses one simulated position shared across the remaining stops. No money moves. All visitors share this disposable workspace and can change its example order statuses. Private tracking access still requires that order's token.

Catalog, business settings, password changes, driver management, integration settings and plugin toggles are blocked by a server request allowlist. Unknown endpoints are denied by default. The browser also disables editing controls. Removing a disabled attribute or calling the API directly does not bypass the policy.

The server replaces customer name, phone, address, notes and custom plugin data with fixed fictional values before storage. Checkout prepopulates the same readonly fields. It never imports an existing installation's data. Web server request metadata and browser submitted bytes still reach the host; this is not an anonymous or private personal data entry service.

Only Installation Lockdown, Order Reporting and DataTables can be active. Stripe and Google Maps stay installed but inactive, and their endpoints are denied. No real payments, external API credentials, WebSocket relay or device GPS are configured. The local Manning Town Centre reference image represents the fixed simulated driver location; there is no live routing or traffic estimate. The host sends `Permissions-Policy: geolocation=()` as an additional browser safeguard.

Orders expire 24 hours after creation and are removed on the next PHP request, together with their dependent ledger, status, GPS and run stop records. Expiring a stop advances and renumbers any remaining stops; empty runs are removed. Completed and cancelled run history also expires after 24 hours. The installation caps retained orders, runs and active sessions at 500 each. Existing login and order rate limits remain, with an additional 60 demo writes per minute per IP. These are abuse limits, not a guarantee against downtime or denial of service.

## Create a separate demo

Run from a complete Git checkout or extracted install package, with Composer dependencies installed:

```sh
php plugins/demo-lockdown/setup.php /absolute/private/dyws-public-demo https://example.com/diner-demo
```

The destination must not exist. The CLI creates a new catalog, private SQLite accounts and orders, random tracking secret, plugin state and three fictional starter orders. It refuses to overwrite an existing directory. Point the installation's private bootstrap adapter or `DYWS_CONFIG` at the resulting `config.json`, and serve only `public_html`. Remove the browser setup folder after installing this explicit CLI configuration. Do not publish the private directory or setup command over HTTP.

Private configuration sets `demo_lockdown: true`, `required_plugins: ["demo-lockdown"]`, the fixed `driver_test_location`, and an integrity fingerprint of the seeded accounts. Only the host owner can edit these files. Changing the approved accounts, enabling an unapproved integration or breaking a required plugin causes bootstrap to return 503 instead of silently removing protection. The plugin is forced first in load order and cannot be disabled through Admin.

On Apache, set the demo location's `Permissions-Policy` header to `geolocation=()` rather than the distribution's device GPS permission. Keep database and catalog permissions private. Back up any prior installation separately before changing its public path or adapter. Do not turn an installation with real data into a public demo by manually changing its passwords.

Validation: `python3 tests/demo-lockdown.test.py` covers both sign in surfaces, API restrictions, fictional data normalization, individual and run delivery completion, fixed GPS, run limits, active and planned run expiry, retention, state tampering and missing or broken protection. The full `npm test` suite also checks that ordinary installations continue to work.
