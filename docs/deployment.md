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

The hosted diner is at `https://sltd.ca/diner/`, with administrator entry at `https://sltd.ca/diner/admin/`. Its private installation path is resolved by the host's ignored `public_html/api/bootstrap-path.php` adapter. Read that adapter when maintaining the host rather than assuming a directory name. Do not commit host credentials or copy a local configuration over hosted data.

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
