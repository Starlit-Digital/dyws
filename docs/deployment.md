# Run and deploy dyws

Use [VERSION](../VERSION) for the application release, [INSTALL.md](../INSTALL.md) for fresh installation and [CHANGELOG.md](../CHANGELOG.md) for release history. This guide describes the current checkout.

## Local development

```sh
composer install --no-dev
npm run setup
npm run serve
```

Serve only `public_html/`. Open `http://127.0.0.1:8097/`. The CLI creates private demo configuration and generated manager and driver credentials in ignored `var/LOCAL-ACCESS.txt`. It refuses to overwrite existing installation data. Browser setup is separate: it creates the chosen admin password without a default driver, then removes `/setup/`.

PHP 8.1 or newer needs PDO SQLite, OpenSSL, curl and mbstring. Node.js and Python 3 run development checks. The storefront itself has no npm dependencies. To test the optional relay, install its pinned dependency with `npm ci --prefix modules/dyws/realtime` using Node.js 22 or newer.

## Pages

| URL under the installation | Purpose |
| --- | --- |
| `/` | Customer storefront. |
| `/admin/` | Administrator entry, redirecting to Orders or sign in. |
| `/auth/` | Administrator sign in, redirecting to Orders on success. |
| `/orders/` | Active orders by default, with Completed, Cancelled and All filters. |
| `/reports/` | Reporting dashboard, charts and exports. |
| `/catalog/` | Categories and items. |
| `/drivers/` | Driver accounts and active delivery maps. |
| `/password/` | Administrator password change. |
| `/settings/` | Business details, timezone, role labels and active plugin settings. |
| `/plugins/` | Plugin activation and settings links. |
| `/driver/` | Driver sign in and assigned deliveries. |
| `/tracking/` | Private order page entered through a checkout tracking link. |
| `/setup/` | Fresh installation only; removed after setup. |

The hosted diner is at `https://sltd.ca/diner-demo/`, with administrator entry at `https://sltd.ca/diner-demo/admin/`. Its private installation path is resolved by the host's ignored `public_html/api/bootstrap-path.php` adapter. Read that adapter when maintaining the host rather than assuming a directory name. Do not commit host credentials or copy a local configuration over hosted data.

## Code deployment

1. Back up the current code, private JSON and SQLite consistently. Pause writes while replacing incompatible code or applying a schema migration. Do not copy an active SQLite main file alone without accounting for its WAL.
2. Install locked Composer dependencies. Deploy matching `plugins/`, `modules/dyws/php/`, `server/` and `vendor/` outside the web root. Keep the configured `examples/` seed files available for fresh setup.
3. Deploy matching `public_html/` contents, including public plugin assets and generated `platform/preloads.json`. Preserve the host's `api/bootstrap-path.php`. Exclude `public_html/setup/` when updating an installed site.
4. Preserve all runtime `var/` files, configured absolute paths, encrypted secrets and the database. Never replace a merchant catalog with an example seed. Keep the test GPS origin only on deployments deliberately configured to simulate a driver.
5. Check PHP compatibility on the target host, API health, anonymous admin redirect, authenticated Orders and a fictional customer to driver completion flow. Reload existing tabs once to load the new code. Later tab returns refresh automatically.

Only `DYWS_CONFIG` and `DYWS_BOOTSTRAP` override private paths. Do not publish the repository root. Application pages use PHP and directory URLs; obsolete HTML entry points are not supported.

## Existing data and migrations

Fresh installs already use SQLite for orders and accounts. `server/migrate-accounts.php` takes a consistent SQLite snapshot and private JSON backups, imports credentials and driver records once per tenant, and archives the imported account files. Run it with the existing configuration path when upgrading an installation that still has JSON credentials. Existing database filenames and tenant IDs are retained.

`server/migrate-catalog.php` supports moving an older configured catalog to private JSON. Use the actual merchant source, not a sample seed. Read the CLI arguments and back up that catalog before running a migration. Normal code updates do not need a catalog migration.

The store initializes additive schema changes, including structured addresses and plugin data. It also renames earlier Stripe ledger tables to provider neutral payment tables. Rolling back across that migration needs matching code and a consistent database backup, with reconciliation for any later writes.

Stripe secrets are encrypted using the private tracking secret and the current `dyws-stripe:` context. Before upgrading a deployment that used a different encryption context, decrypt with its running implementation and reencrypt with the new implementation under a private backup. A code upload alone cannot migrate an encrypted credential file. Preserve the secret and encrypted settings together.

## Plugins, maps and realtime

Both halves of each plugin must be deployed. The bundle includes Google Maps, Stripe, Order Reporting and DataTables. Fresh installations activate all four; saved deactivation choices persist. Activation does not configure a Maps key or enable Stripe Checkout. Plugins are trusted code installed through Git or file upload, then managed in Admin.

Use Settings for plugin configuration. Stripe accepts sandbox keys only and requires signed webhooks. No real charge or refund is performed by manual test ledger controls. Google Maps requires its enabled browser key and API configuration. See [plugin contracts](plugins.md), [payments](catalog-and-payments.md) and [maps and realtime](gps-maps-realtime.md).

The hosted demo uses HTTPS polling. A WebSocket relay is optional and must be deployed separately behind TLS. Do not configure a relay URL until the service is reachable. Never expose its private shared secret to browsers.

## Maintenance and recovery

`php server/cleanup.php` removes expired GPS, sharing sessions, operator sessions and rate buckets, and scrubs demo customer name, phone, structured address and notes after seven days. Aggregate order and payment amounts remain. No cleanup scheduler is installed automatically.

Back up private configuration, catalogs, settings and SQLite together. Protect backups as private data. Verify restores before relying on them. Restore matching code and data deliberately; an older code directory alone may not understand migrated records. Hosted backups and access files are operational records, not source repository artifacts.

## Verification and optional download

```sh
npm test
npm run test:realtime
npm run build:zip
npm run verify:release
DYWS_INSTALL_ARCHIVE="$PWD/dist/dyws.zip" python3 tests/installer.test.py
```

The complete Git checkout is the primary distribution. Packaging is optional and produces ignored `dist/dyws.zip` and `dist/SHA256SUMS`. Stage new source before packaging. Publish these files as release assets alongside the tagged source; do not commit generated downloads. Verify downloaded assets with `shasum -a 256 -c SHA256SUMS` in their directory.

Tests cover authentication, pricing, idempotency, tenant boundaries, catalog revisions, plugin lifecycle and hooks, payment verification, reporting, installation, GPS, refresh recovery and edit protection. Stripe tests use a fake transport and the SDK signature verifier; they do not prove an external sandbox Checkout has succeeded. Browser measurements in [the timing review](performance-2026-10-23.md) are dated samples, not current performance guarantees.

## Stripe tracking return fix

Deploy the matching `plugins/stripe/StripePayments.php` to the private plugin directory. This change needs no database migration or public asset update. New Checkout sessions return to the installation's `tracking/?order=ORDER_REFERENCE` page using the existing order cookie. Webhooks remain responsible for payment state. Existing Stripe sessions retain their original return URLs and continue to be reused; do not erase payment attempts to force a replacement.

The hosted public demo now uses an isolated database and the mandatory [Installation Lockdown plugin](demo-lockdown.md). Its bootstrap adapter selects that private configuration. Earlier runtime records are preserved privately and are not exposed through the public demo. Do not copy real orders, credentials, payment settings or customer contacts into this installation.


### Delivery run schema upgrade

The current development build adds `delivery_runs` and `delivery_run_stops` with tenant scoped foreign keys and partial unique indexes for open driver runs and order membership. Startup creates these tables without rewriting existing orders, credentials, catalog or settings. Existing individual deliveries remain usable. Back up SQLite with its backup API or `VACUUM INTO`, not by copying an open database without its WAL. Deploy `DeliveryRuns.php` with the rest of the PHP module and the matching Orders, driver and tracking assets. The flow was validated first on private `/diner/` and is also available on public `/diner-demo/`. Update the Installation Lockdown policy with the matching code so its precise run allowlist and expiry cleanup are present. Preserve its mandatory plugin configuration, public accounts and disabled device GPS policy.

Driver vehicle details add two optional text columns to the SQLite drivers table. Account startup migrates existing databases within a transaction and preserves names, passwords, activity and sessions. Deploy matching account schema, PHP handlers and public driver editor assets together. Customer tracking includes driver display details in both PHP startup and subsequent updates. Back up SQLite before rollout.

## Checkout review and customer tracking update

Deploy the matching PHP Store and page preview modules, customer tracking and ordering JavaScript and styles, new confirmation countdown, tracking details and order date filter modules, and regenerated preload manifest together. No schema or catalog migration is needed. Preserve existing adapters, private settings and business records. The date presets filter the currently loaded board, which remains limited to 200 orders with active orders first. This week starts Monday in the configured business timezone.

The compact delivery checkout requires the matching Store update: only the structured street address is required, while unit and locality fields are optional. Existing full addresses and freeform requests remain supported; no stored addresses are rewritten. Deploy this backend before or alongside the simplified form.

## Order Format plugin

Deploy both `plugins/order-format/` and `public_html/plugins/order-format/`, together with the matching `Features.php`, browser plugin host, ordering component, `order-layout.js`, ordering styles and regenerated preload manifest. The private plugin directory includes `Templates.php` and `schema.json`. No database migration is needed. The release builder checks for both halves of this plugin.

Activate Order Format through Admin → Plugins on ordinary installations. Activation does not assign a template, so every stage retains its existing format. Never replace a merchant's private `order-format-*.json` during code deployment. Back up that file with the other settings. Deactivation is the immediate rollback for new page loads and preserves all saved templates and assignments.

For the public demo, deploy the matching Installation Lockdown policy before owner activation. It allows Order Format and its read endpoints, but rejects all template writes. The editor exposes a locked saving notice while still permitting layout previews. Keep `required_plugins`, account settings, catalogs and runtime databases intact.

## Payment connector foundations

Deploy the shared `modules/dyws/php/Payments/` transport and registration helpers before the matching `Plugins.php`. Include each provider's private and public plugin directories, manifests, bundled callback allowlist, hook catalog, shared settings controller, plugin type controller, stylesheet and regenerated preloads. No database migration is required. Preserve existing activation state and encrypted credentials. New connectors remain inactive and do not enable checkout. Keep the public demo's activation and settings restrictions. [Connector configuration and limitations](payment-connectors.md).

## Business location migration

The October 24 location update adds `orders.order_location_json` on first database access using the existing additive migration path. Back up the private SQLite database and catalog before updating. No runtime catalog or account changes are required. Catalogs without a location list retain their single pickup address. Deploy the PHP catalog and store changes together with the updated Business settings, ordering, order list, driver, tracking and layout assets. Custom order layouts that omit the location field retain it above their layout. Locations share a tenant catalogue, tax and delivery fee; branch specific menus, permissions and fees are not introduced by this change.

The location update was deployed to both `/diner/` and `/diner-demo/` on October 24, 2026. Each installation received the same 15 matching runtime files after private code, JSON and consistent SQLite backups. Live asset hashes, health endpoints, schema and database integrity checks passed. Checkout and review were checked in the browser. The public demo continues to reject Business settings writes. Later location edits in the private diner were preserved. See [deployment verification](locations-deployment-20261024.json).

## Driver profile icon update

Deploy the matching Installation Lockdown policy first. Its account integrity fingerprint excludes the cosmetic `profileIcon`, while retaining credential and account protection. Deploy `accounts.sql` and `AdminAccounts.php`, then initialize accounts with the existing private configuration to add `drivers.profile_icon` with default `car`. Back up SQLite consistently first. Existing names, passwords, vehicles, activity, orders and locations remain intact.

Deploy the matching API, page data, Store, driver console, driver and customer views, Google Maps renderer, local SVG assets and licenses, and regenerated preloads. The public demo permits only the signed in driver's validated icon preference through `/driver/profile`; its manager account and business settings stay locked. No existing runtime JSON needs replacement.

The profile picker was deployed to both `/diner/` and `/diner-demo/` on October 24, 2026, after consistent private SQLite, JSON and code backups. Final source hashes, public assets, database integrity and existing driver fields were verified. The full test suite passed. Browser checks covered the default, all six choices, saving, reload persistence and the phone layout. See [deployment verification](driver-profiles-deployment-20261024.json).

### Driver vehicle profile fields

Deploy `AdminAccounts.php` together with the profile controller, `vehicle-colors.js`, shared CSS, manager account editor and Drivers page, plus regenerated preloads. No schema migration is needed. Model and colour now save with the authenticated driver's own profile, and manager account edits preserve these fields. Keep existing vehicle values, including custom legacy colours. The 32 colour chits are 16px squares with larger clickable labels and native radio keyboard controls. The existing public demo policy already permits these display fields without relaxing account or business protections.

The vehicle profile update was deployed to `/diner/` and `/diner-demo/` on October 24, 2026. Both installations received seven matching runtime files, with private backups and checks that preserved existing driver records and JSON settings. Hosted asset hashes, profile access, colour validation and the live picker passed verification. See [deployment verification](vehicle-profile-deployment-20261024.json).

The Nominatim address service runs separately on the confirmed PayCal VPS, while
DYWS stays on shared hosting. Follow [the service operations guide](../services/nominatim/README.md)
and [plugin provisioning](nominatim.md). The public diner demo uses local fictional
suggestions and does not forward visitor input to the geocoder.
