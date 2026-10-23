# Run and deploy

## Local

Requirements: PHP 8.1 or newer with PDO SQLite, Node.js for frontend tests, Python 3 for HTTP tests. Install the pinned Stripe PHP SDK with Composer. The storefront has no npm dependencies. The optional realtime service has a pinned ws dependency.

```sh
composer install --no-dev
npm run setup
npm run serve
npm test
```

Setup creates `var/config.json` and `var/LOCAL-ACCESS.txt`, both private and ignored by Git. Setup refuses to overwrite an existing config. Open http://127.0.0.1:8097 and use the manager and driver credentials from that local file. Never serve the repository root. Serve only `public_html/`.

## Hosted example

The existing https://sltd.ca/diner/ demo now uses the backend. Customer menu, manager.html and driver.html share its API. Public deploy files live under `domains/sltd.ca/public_html/diner/` on pct-hostinger. Private application code and SQLite state live under `domains/sltd.ca/private/starlit-go/` outside the web root. Config is private and the SQLite database is never copied into public_html.

The ignored `public_html/api/bootstrap-path.php` file returns the private bootstrap path. On this host, set `STARLIT_GO_CONFIG` in a private bootstrap wrapper or use the private install’s default `var/config.json`. Local and hosted configurations are separate. Deployed catalog paths must reference the deployed catalog, not a Mac path.

Hosted demo access is saved locally at `var/HOSTED-DEMO-ACCESS.txt`, permissions 0600. Passwords and session tokens are not committed or embedded in JavaScript. This is the file the owner should use to sign in at manager.html and driver.html.

A backup of the prior static diner was made at `domains/sltd.ca/private/deploy-backups/starlit-go-backend-20261023/`. Restoring that public directory returns the original frontend demonstration; do not delete the private database during a frontend rollback.

## Data maintenance

`php server/cleanup.php` deletes expired GPS positions and sessions, removes expired rate buckets, and scrubs customer name, phone, delivery address and notes from demo orders older than seven days. It preserves aggregate order and payment amounts. Run from the private installation. A host scheduler has not been installed automatically. Configure scheduling and backups before a real pilot, and define a separate approved retention policy for real business records.

Back up SQLite with a coordinated SQLite backup or snapshot procedure, not by copying an active main database file without its WAL. Keep secrets and database backups private. Restore testing, monitoring and alerting remain production work.

## Demonstration walkthrough

1. Place a delivery test order on the diner page with fictional details. Confirmation redirects to a private order status page.
2. Sign in as manager. Accept, prepare and mark ready. Assign Demo Driver. Record test payment.
3. Sign in as demo-driver. Start the delivery. GPS begins automatically after browser permission is granted; keep the page visible.
4. Watch the customer’s order status page update its timeline and marker. GPS has a stale warning, latest timestamp and accuracy value.
5. Mark delivered. The customer sees completion and the backend removes location access. Optionally record a full test refund and confirm that collections reconcile.

## Validation on October 23, 2026

Four JavaScript cart tests, 28 PHP service checks and 14 HTTP boundary checks passed. Checks cover server pricing, idempotency, role access, tenant isolation, state transitions, assignment, duplicate payments and refunds, reporting reconciliation, GPS authorization, coordinates, timestamps, ordering and removal, and tracking token expiry. Hosted browser testing exercises checkout, manager board, driver assignment, test payment and inline tracking with simulated GPS. Native background location and actual payment processing are not tested or implemented.

## Catalog and Stripe deployment upgrade

Deploy `server/` and Composer `vendor/` to the private installation, never public_html. Run `php server/migrate-catalog.php /absolute/private/var/config.json https://sltd.ca/diner` once to move the existing configured catalog into private JSON without overwriting credentials. The runtime catalog is not overwritten by future code deployments. New local setup copies the diner seed from examples into private var.

Then deploy public_html, including settings.html, and retain the existing private bootstrap path. The old static ordering/catalog.json can be removed after its private migration and backup. The SDK uses its pinned default API version. Configure sandbox credentials and the webhook in admin settings; no Stripe account is configured by deployment itself.

October 23 catalog and Stripe upgrade validation: 98 checks pass, comprising five cart tests, 28 backend checks, 26 HTTP checks and 39 catalog and Stripe checks. Hosted browser verification saved the private catalog and placed order SG-6547CD1FE1B9 through the migrated storefront. The Stripe SDK was audited with no reported dependency advisories. Stripe credentials remain unset; no external Stripe sandbox payment was performed. Backup: domains/sltd.ca/private/deploy-backups/starlit-go-catalog-stripe-20261023/.

For a local checkout where the old tracked catalog has already moved, pass the seed explicitly as the third migration argument: `php server/migrate-catalog.php var/config.json http://127.0.0.1:8097 examples/starlit-diner/catalog.json`. Do not replace a modified merchant catalog with that seed.

## dyws CSS extraction

The demo loads `dyws/dyws.css?v=19`, and the cart loads `dyws/ordering.css?v=19` inside its shadow root. Deploy the entire dyws folder together with the updated HTML and JavaScript. The former CSS URLs forward to these files. No runtime catalog or database migration is needed. The catalog migration CLI now resolves relative config paths before storing an absolute catalog path, preventing local preview failures.

October 23 validation: all 98 existing checks passed. Browser checks covered desktop and mobile catalog/cart layouts, light and dark cart themes, 48px quantity buttons, admin styling and a plain host page using only dyws CSS. The isolated page confirmed that unrelated host controls keep their native styles. Frontend backup: domains/sltd.ca/private/deploy-backups/starlit-go-dyws-css-20261023/public-diner/.

## dyws JavaScript and PHP modules

The homepage is now index.php. Preserve the DirectoryIndex setting and existing security headers in public_html/.htaccess. Move the old index.html out of the public folder after backing it up, so the PHP homepage is the sole entry point.

Deploy modules/dyws/php to the private installation's modules/dyws/php folder first, then deploy server compatibility adapters, then public_html. The public api/bootstrap-path.php remains unchanged and private credentials, runtime catalog and SQLite state are not part of the upload. No database migration or catalog replacement is needed. The Composer autoloader remains in private vendor and is loaded by the server adapter. A new host can include module.php and dispatch dyws_serve_api with its own private configuration path.

The browser package is now @starlit-digital/dyws, with ES module entry index.js and the existing CSS subpaths. Website scripts pass endpoint URLs, page elements and diner map functions into the package. A separate shop example is in examples/php-host. All imports in the browser package resolve within its folder.

Validation on October 23: 115 checks passed, comprising eight JavaScript checks, 28 backend checks, 27 HTTP checks, 39 catalog and Stripe checks and 13 PHP rendering checks. The raw HTTP homepage contains five category panels and 35 items before JavaScript. Local browser checkout, variant and quantity controls, tracking, manager status updates, settings and driver login were verified. A second site with copied JavaScript/CSS/PHP packages, separate catalog and separate database successfully placed a test order and synchronized a category panel with a separate featured item. External Stripe payment execution remains untested and disabled without credentials.

Rollback files are in domains/sltd.ca/private/deploy-backups/dyws-modules-20261023/. Restore both public-diner and server together. The new private module folder can remain unused after rollback; preserve the database and catalog.

Hosted verification after deployment confirmed five PHP category panels, 35 products, the package driven cart and order SG-8FBF4C91398D with inline tracking. Only fictional test details were used. No payment was taken.

## Admin tabs and catalog editor

Deploy modules/dyws/php first, then public_html. The five admin pages use dyws browser package version 0.3.0. Existing credentials are unchanged. Account overrides are created only when an administrator saves driver settings or changes the admin password. Keep accounts-*.json private, and never overwrite these files during code deployments. No database or catalog migration is needed.

The catalog editor loads the runtime JSON and saves through the existing revision checked API. Tests use temporary data rather than the hosted business catalog. The old settings.html address redirects to catalog-admin.html, while Stripe settings are on stripe-admin.html.

October 23 admin upgrade validation: 144 checks passed, including account creation, duplicate ID rejection, password verification and session revocation, disabled driver access, assignment rules, stale revisions and catalog decimal conversion. Browser testing used a separate temporary backend and saved edited item fields, new categories, new items and option prices back to JSON, then updated a driver name. Reports, catalog, drivers, Stripe and password navigation were checked. Password changes were tested against isolated backend fixtures; deployment does not change the owner's passwords.

Backup: domains/sltd.ca/private/deploy-backups/dyws-admin-20261023/. Restore the public-diner and php code directories together if needed. Preserve runtime accounts files, catalog and SQLite data. Older code will not read account overrides, so reconcile credentials deliberately before rolling back after a password change.

## General Settings page

`settings-admin.html` adds the Settings tab. The old `settings.html` shortcut now opens this page. Role labels default to Driver and Drivers until explicitly saved. Saves create `settings-<tenant hash>.json` beside the private database, with mode 0600. Preserve this file during deployments and backups alongside account overrides. Deploy `modules/dyws/php/Settings.php` with the other private modules. No database migration or credential reset is needed.

## GPS, maps and optional realtime upgrade

Deploy private modules/dyws/php and server/cleanup.php first, then public_html, excluding api/bootstrap-path.php. Preserve all private var files, credentials, catalog, accounts and settings. The idempotent schema creates location_shares and realtime_versions on first access; no existing orders are replaced. Maps settings use a new private maps-<tenant hash>.json file only when saved.

The hosted demo stays on HTTPS polling. WebSocket hosting is deferred to the owner's separate server. No relay URL or relay secret is inserted by deployment. The owner subsequently saved a Google key through Settings. See gps-maps-realtime.md for setup, pricing and caching behaviour. Google maps and routes were then verified in the live admin and customer views.

Rollback backup: domains/sltd.ca/private/deploy-backups/dyws-gps-maps-20261023/. Restore public-diner and php together; preserve live SQLite and all runtime JSON. New tables can remain during rollback. Backups contain code, not a consistent database snapshot.

The destination upgrade also adds orders.address_json idempotently. Preserve driver_test_location in this test deployment until the owner requests real device GPS again. It is a private test setting, not a default for other installations. The driver page no longer artificially stops an active session when visibility changes; browser permission and background limits still apply.

Final GPS, maps and routing validation: 239 automated checks passed across the core and relay suites. Browser verification confirmed a Google map and route on the live Drivers tab and customer order page, and a full structured address checkout with its private page redirect. Source changes and the hosted key remain separate.

## dyws rename and compact administration

The private repository is now Starlit-Digital/dyws. The existing hosted private path, environment aliases, session storage keys, API URLs and diner URL remain compatible. The storefront is still the Starlit Diner example.

Deploy the updated public files and the private Catalog.php and api.php modules. Keep api/bootstrap-path.php and all private runtime files. Update only the catalog platformName through its revision checked manager API to adopt the dyws name; never replace a merchant catalog with the example seed.

All six admin pages share the same compact header, current page navigation and sign out. On narrow screens navigation uses an expandable menu with keyboard dismissal. Detailed report definitions and connection instructions remain available in disclosures. The driver editor opens only on Add or Edit. The logo derives from the approved Community Central SVG family with a D monogram; the editable SVG and 2048px PNG master are in public_html/assets.

Validation: 238 automated checks passed. Browser checks covered all six pages, the driver editor, sign out, mobile navigation at 320px and 390px, Escape dismissal, and the live Google map and route. The release backup is domains/sltd.ca/private/deploy-backups/dyws-admin-simple-20261023/.

## Browser installer and SQLite accounts, version 0.4.0

See INSTALL.md for fresh setup. Ship the root dyws.zip built by scripts/build-release.py. It contains tracked application code and locked Composer dependencies, with no runtime var data. The initial storefront redirects to setup when its configuration is absent. A fresh install verifies the environment and private ownership key, creates a SQLite database and JSON site configuration, and removes public_html/setup. Configuration and installed.lock both prevent reinstallation, even after setup is uploaded again.

Existing installations keep their current database filename and tenant. Deploy AdminAccounts.php and accounts.sql together, then run server/migrate-accounts.php with the existing configuration path. The CLI takes a consistent SQLite backup and private JSON backups before importing. It preserves existing passwords, driver IDs, active state, assignments and sessions, then removes credentials from active JSON. New account writes go only to SQLite; site settings and catalog writes remain JSON. Never upload the fresh setup directory over an existing hosted demo or replace its private data.

Public changes include the new setup directory for fresh installations, optional generic storefront template, and an unconfigured homepage redirect. Existing diner configuration still selects its original website.

Validation: 314 automated checks passed, including fresh HTTP installation, installer removal, reinstall protection, private storage boundaries, SQLite account migration, preserved passwords and inactive drivers, JSON business settings, and order persistence. The extracted ZIP also passes the 40 HTTP installation checks. A preupgrade code backup, consistent database snapshot and private JSON backups are in domains/sltd.ca/private/deploy-backups/dyws-installer-20261023/.
