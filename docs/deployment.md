# Run and deploy

## Local

Requirements: PHP 8.1 or newer with PDO SQLite, Node.js for frontend tests, Python 3 for HTTP tests. There are no Composer or npm dependencies.

```sh
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
