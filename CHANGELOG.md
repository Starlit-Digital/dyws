# Changelog

## Unreleased

- Add manually ordered delivery runs, atomic pickup, one active run per driver, per stop completion, shared GPS and private stops ahead tracking. Start rollout on the private diner installation.
- Add shared semantic status badges to Orders, delivery runs, driver accounts, plugin states, provider settings, reports and customer payment status. Labels and glyphs accompany every colour.
- Connect the customer progress steps into a responsive timeline with clear completed, current and upcoming states, accessible labels and theme aware contrast.

- Move the hosted example to `/diner-demo/` with isolated fictional data and public `admin / admin` and `driver / driver` accounts.
- Bundle an optional Demo Lockdown plugin with server enforced critical setting restrictions, simulated GPS, disabled external payments and maps, bounded temporary records and fictional checkout data.
- Add mandatory installation plugins and five policy, input and presentation hooks. Required protection cannot be deactivated in Admin and fails closed when its files are missing or broken.

- Return newly created Stripe Checkout sessions to the correct private order page after payment or cancellation, using the existing order cookie and preserving webhook payment verification.

- Make the complete Git checkout the primary development and installation workflow.
- Keep the optional install ZIP and checksum in ignored `dist/`, published as release assets instead of committed binaries.
- Update installation, development and packaging instructions. Existing 0.10.0 release downloads remain available.
- Audit current documentation against the implementation: correct account storage, authentication, tracking, plugin hooks, routes, module paths and map behavior; consolidate deployment guidance and remove obsolete naming history.

## 0.10.0 · October 23, 2026

First packaged GitHub preview release of dyws. This tag includes the complete earlier development history and the recent startup, tracking and administrator refresh work.

### Customer and driver experience

- Generic categorized catalog, reusable PHP rendering, scoped CSS and JavaScript modules, cart quantities, option prices and structured delivery checkout.
- Private order status pages with progress, conditional route estimates and delivery completion confirmation.
- Driver sign in, assigned delivery details, pickup and completion controls, and scoped browser GPS during active deliveries.
- Tracking reads recover from stalled connections. Returning to a tab or window and reconnecting refresh the relevant operational pages.
- Diner reference website with photographs, a hero, display preferences and fictional business details.

### Administration and plugins

- Protected PHP administration, standalone sign in and Orders as the default landing page.
- Active orders first with DataTables search, sorting and filters; separate Reports, Catalog, Drivers, Password, Settings and Plugins pages.
- Automatic refresh across administration with form snapshots, editing guards, saved revision preservation and protection against older responses overtaking edits.
- Bundled Google Maps, Stripe sandbox, Order Reporting and DataTables plugins with private settings and 32 documented hook contracts.
- PHP Provides and Requires attributes resolve the browser features needed by each page.
- UTC storage, a configurable display timezone, reporting charts, comparisons, CSV and SVG exports.

### Packaging and documentation

- A complete README feature breakdown and twelve reviewed screenshots from a separate fictional local fixture.
- A root VERSION file aligned with the application and browser package manifests. Plugins and the optional relay retain independent component versions.
- A single installation ZIP including locked PHP dependencies, the optional relay source and lockfile, version and changelog files, and a per file hash manifest.
- SHA256SUMS and a release verification command covering archive contents, source consistency, version alignment, private file exclusions and README images.
- Separate detailed documentation, version preparation and package commits, each with an annotated tag.

### Validation

Release verification runs the complete application suite, the WebSocket relay integration suite, archive verification and the extracted ZIP browser installer tests. Browser walkthroughs cover the example checkout, admin screens, driver sign in, delivery completion and automatic customer confirmation. Screenshots contain fictional data only.

### Upgrade notes

Back up code and private storage before deployment. Preserve runtime JSON, SQLite, credentials and the host's private bootstrap adapter. Do not deploy setup over an installed merchant site. Update both private plugin implementations and their public assets, PHP modules and browser modules together. This release's final preparation changes packaging and documentation; it does not require a database migration from the 0.9.4 development checkout that preceded this release.

Use directory routes such as `/admin/`, `/orders/`, `/driver/` and `/tracking/`, and current dyws identifiers. Obsolete HTML routes, index.php links and earlier component aliases are intentionally unsupported. Existing pages should be reopened once after uploading updated scripts.

### Preview limits

This is a demonstration release, not a production delivery service. Stripe is sandbox only, the hosted diner uses HTTPS polling and a simulated origin, and Google Maps requires configuration. Native mobile applications, reliable background GPS, marketplace payouts and managed production operations are not included. The optional WebSocket relay must be deployed separately.
