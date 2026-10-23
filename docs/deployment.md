# Run and deploy

## Local

Requirements: PHP 8.1 or newer with PDO SQLite, Node.js for frontend tests, Python 3 for HTTP tests. Install the pinned Stripe PHP SDK with Composer. There are no npm dependencies.

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

1. Place a delivery test order on the diner page with fictional details. Confirmation creates inline tracking on that same page.
2. Sign in as manager. Accept, prepare and mark ready. Assign Demo Driver. Record test payment.
3. Sign in as demo-driver. Start the delivery and choose Simulate test route, or explicitly choose Share my GPS to send the browser’s real location while the page is running.
4. Watch the customer’s original page update its timeline and marker. GPS has a stale warning, latest timestamp and accuracy value.
5. Stop GPS and mark delivered. The customer sees completion and the backend removes location access. Optionally record a full test refund and confirm that collections reconcile.

## Validation on October 23, 2026

Four JavaScript cart tests, 28 PHP service checks and 14 HTTP boundary checks passed. Checks cover server pricing, idempotency, role access, tenant isolation, state transitions, assignment, duplicate payments and refunds, reporting reconciliation, GPS authorization, coordinates, timestamps, ordering and removal, and tracking token expiry. Hosted browser testing exercises checkout, manager board, driver assignment, test payment and inline tracking with simulated GPS. Native background location and actual payment processing are not tested or implemented.

## Catalog and Stripe deployment upgrade

Deploy `server/` and Composer `vendor/` to the private installation, never public_html. Run `php server/migrate-catalog.php /absolute/private/var/config.json https://sltd.ca/diner` once to move the existing configured catalog into private JSON without overwriting credentials. The runtime catalog is not overwritten by future code deployments. New local setup copies the diner seed from examples into private var.

Then deploy public_html, including settings.html, and retain the existing private bootstrap path. The old static ordering/catalog.json can be removed after its private migration and backup. The SDK uses its pinned default API version. Configure sandbox credentials and the webhook in admin settings; no Stripe account is configured by deployment itself.

October 23 catalog and Stripe upgrade validation: 98 checks pass, comprising five cart tests, 28 backend checks, 26 HTTP checks and 39 catalog and Stripe checks. Hosted browser verification saved the private catalog and placed order SG-6547CD1FE1B9 through the migrated storefront. The Stripe SDK was audited with no reported dependency advisories. Stripe credentials remain unset; no external Stripe sandbox payment was performed. Backup: domains/sltd.ca/private/deploy-backups/starlit-go-catalog-stripe-20261023/.

For a local checkout where the old tracked catalog has already moved, pass the seed explicitly as the third migration argument: `php server/migrate-catalog.php var/config.json http://127.0.0.1:8097 examples/starlit-diner/catalog.json`. Do not replace a modified merchant catalog with that seed.

## DYWS CSS extraction

The demo loads `dyws/dyws.css?v=19`, and the cart loads `dyws/ordering.css?v=19` inside its shadow root. Deploy the entire dyws folder together with the updated HTML and JavaScript. The former CSS URLs forward to these files. No runtime catalog or database migration is needed. The catalog migration CLI now resolves relative config paths before storing an absolute catalog path, preventing local preview failures.

October 23 validation: all 98 existing checks passed. Browser checks covered desktop and mobile catalog/cart layouts, light and dark cart themes, 48px quantity buttons, admin styling and a plain host page using only DYWS CSS. The isolated page confirmed that unrelated host controls keep their native styles. Frontend backup: domains/sltd.ca/private/deploy-backups/starlit-go-dyws-css-20261023/public-diner/.

## DYWS JavaScript and PHP modules

The homepage is now index.php. Preserve the DirectoryIndex setting and existing security headers in public_html/.htaccess. Move the old index.html out of the public folder after backing it up, so the PHP homepage is the sole entry point.

Deploy modules/dyws/php to the private installation's modules/dyws/php folder first, then deploy server compatibility adapters, then public_html. The public api/bootstrap-path.php remains unchanged and private credentials, runtime catalog and SQLite state are not part of the upload. No database migration or catalog replacement is needed. The Composer autoloader remains in private vendor and is loaded by the server adapter. A new host can include module.php and dispatch dyws_serve_api with its own private configuration path.

The browser package is now @starlit-digital/dyws, with ES module entry index.js and the existing CSS subpaths. Website scripts pass endpoint URLs, page elements and diner map functions into the package. A separate shop example is in examples/php-host. All imports in the browser package resolve within its folder.

Validation on October 23: 115 checks passed, comprising eight JavaScript checks, 28 backend checks, 27 HTTP checks, 39 catalog and Stripe checks and 13 PHP rendering checks. The raw HTTP homepage contains five category panels and 35 items before JavaScript. Local browser checkout, variant and quantity controls, tracking, manager status updates, settings and driver login were verified. A second site with copied JavaScript/CSS/PHP packages, separate catalog and separate database successfully placed a test order and synchronized a category panel with a separate featured item. External Stripe payment execution remains untested and disabled without credentials.

Rollback files are in domains/sltd.ca/private/deploy-backups/dyws-modules-20261023/. Restore both public-diner and server together. The new private module folder can remain unused after rollback; preserve the database and catalog.

Hosted verification after deployment confirmed five PHP category panels, 35 products, the package driven cart and order SG-8FBF4C91398D with inline tracking. Only fictional test details were used. No payment was taken.
