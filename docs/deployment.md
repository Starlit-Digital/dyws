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

The hosted diner is at `https://dyws.ca/`, with administrator entry at `https://dyws.ca/admin/`. Its private installation path is resolved by the host's ignored `public_html/api/bootstrap-path.php` adapter. Read that adapter when maintaining the host rather than assuming a directory name. Do not commit host credentials or copy a local configuration over hosted data.

## Code deployment

1. Back up the current code, private JSON and SQLite consistently. Pause writes while replacing incompatible code or applying a schema migration. Do not copy an active SQLite main file alone without accounting for its WAL.
2. Install locked Composer dependencies. Deploy matching `plugins/`, `modules/dyws/php/`, `server/` and `vendor/` outside the web root. Keep the configured `examples/` seed files available for fresh setup.
3. Deploy matching `public_html/` contents, including public plugin assets and generated `platform/preloads.json`. Preserve the host's `api/bootstrap-path.php`. Exclude `public_html/setup/` when updating an installed site.
4. Preserve all runtime `var/` files, configured absolute paths, encrypted secrets and the database. Never replace a merchant catalog with an example seed. Keep the test GPS origin only on deployments deliberately configured to simulate a driver.
5. Check PHP compatibility on the target host, API health, anonymous admin redirect, authenticated Orders and a fictional customer to driver completion flow. Reload existing tabs once to load the new code. Later tab returns refresh automatically.

Only `DYWS_CONFIG` and `DYWS_BOOTSTRAP` override private paths. Do not publish the repository root. Application pages use PHP and directory URLs; obsolete HTML entry points are not supported.

## Public demo cutover, October 25, 2026

The sole public demo is now `https://dyws.ca/`. Public DNS and HTTPS are verified for the apex and `www` hostnames. The old `sltd.ca/diner/` and `sltd.ca/diner-demo/` installations have been removed from the public web root and their private runtimes archived outside it. Both former URLs return 404. Starlit marketing links and the GitHub demo link point to dyws.ca. Earlier deployment records below remain historical.

## dyws.ca hosting, October 24, 2026

The owner requested `dyws.ca` on the existing Hostinger shared hosting account. The PHP/HTML website was created in hPanel under Premium Web Hosting, bringing the plan to 22 of 100 websites. The initial default page has now been backed up outside the web root and replaced with an isolated Starlit Diner public demo running DYWS 0.11.1.

| Setting | Confirmed value |
| --- | --- |
| Domain registrar | Namecheap |
| DNS provider | Namecheap BasicDNS |
| Nameservers | `dns1.registrar-servers.com`, `dns2.registrar-servers.com` |
| Root record | `A @ 191.101.13.124`, TTL 300 seconds |
| www record | `CNAME www dyws.ca.`, TTL 300 seconds |
| Hosting plan | Existing Hostinger Premium Web Hosting |
| Website type | PHP/HTML website |
| SSH alias | `pct-hostinger` |
| Server | `191.101.13.124`, SSH port `65002` |
| Hosting account | `u394197407` |
| Document root | `/home/u394197407/domains/dyws.ca/public_html` |
| hPanel dashboard | `https://hpanel.hostinger.com/websites/dyws.ca` |
| Temporary preview | `https://orchid-chough-371816.hostingersite.com/` |

The owner clarified that Namecheap must remain the DNS provider, matching the other domains. An initial change to Hostinger nameservers was reversed. Namecheap BasicDNS is restored. The former `www` parking CNAME was changed to `dyws.ca.`, and the apex URL redirect was changed into the Hostinger A record. Both web records use the 300 second TTL shown by Hostinger's Connect via DNS records guide. The existing email forwarding settings, registration and renewal settings were left as they were; no email forwarders were defined.

Verification after correction: Namecheap displayed BasicDNS and the saved A and CNAME records. Both `dns1.registrar-servers.com` and `dns2.registrar-servers.com` returned the apex A record `191.101.13.124` and the `www` CNAME chain to that same IP, each with TTL 300. Hostinger's Connect via DNS records verification was started. Its website connection and SSL installation were still pending. The .ca parent zone and public resolver had not yet published or resolved this newly registered domain. Hostinger advised allowing up to 24 hours for connection. The earlier SSH check confirmed the document root and default page on the existing shared account, and an HTTP request for `dyws.ca` directed to `191.101.13.124` returned 200 and Hostinger's Default page.

After propagation, verify the public Namecheap delegation, apex and `www` resolution, Hostinger's Connected status and a valid HTTPS certificate before describing the domain as live. Keep DNS records at Namecheap and hosting at Hostinger. No application, data, credentials or source repository was uploaded as part of this hosting setup. Keep future private application files and configuration outside `public_html`.

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

## Order printer pilot

Keep Order Printer inactive until a private hardware pilot is ready. It needs a reachable HTTPS `public_base_url`, the private plugin files, public plugin assets and regenerated preload entries. Its SQLite tables retain configuration and jobs across deactivation. No live installation is changed by adding this source. See [deployment details and limitations](order-printer.md#deployment-and-next-steps).

### dyws.ca application installation

On October 24 the public diner test was deployed at the dyws.ca root from engine commit `34f747fb5f4dbcbbb04e02ee2b9fd26598fd36a8`, version 0.11.1. The owning private site repository is `Starlit-Digital/dyws.ca`, with DYWS pinned as a submodule. Private source is under the domain's `private/releases/0.11.1`, with a newly seeded `private/demo-data` workspace. Existing diner installations were not copied or reset. Direct HTTP virtual host checks passed at installation. Public DNS and TLS were subsequently verified on October 25, and dyws.ca is now the sole public demo. See the site repository deployment receipt for current verification.


## Remembered guest details

Deploy the matching PHP module, schema, JavaScript assets, `public_html/terms/`, styles and storefront adapters together. New SQLite tables are created automatically without rewriting order records. Serve the terms directory using the existing `DirectoryIndex page.php home.php` rule. Custom routers must map `/terms/` to `terms/page.php`.

Configure the correct HTTPS `public_base_url`, including any installation subdirectory, before enabling remembered details. The cookie uses that path and the business identity. Forward the original HTTPS request information correctly when terminating TLS at a proxy. Changing the origin, installation path or tenant requires customers to opt in again.

Expiry is checked on every saved details request. Bootstrap also removes expired profiles and their addresses for this business. For quiet installations, schedule the dedicated command below daily with the existing private configuration:

```sh
DYWS_CONFIG=/private/path/config.json php /path/to/dyws/server/cleanup-guest-details.php
```

This command only removes expired saved details. It does not scrub order records. The older `server/cleanup.php` also scrubs demonstration order contacts and must not be substituted for this task. Backups follow the installation's existing private backup retention policy.

The public demo continues to use server enforced fictional order contacts; remembered contacts are copied from those validated orders. Verify with `npm test`, including the guest API checks for consent, 180 day sliding expiry, idempotency, deletion, tenant isolation, cookie flags and stale checkout behavior.
