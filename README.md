# dyws

Product ordering and delivery infrastructure for a business’s own website. Your website. Your orders. Delivered.

Private repository: https://github.com/Starlit-Digital/dyws

Starlit Diner is the fictional example at https://sltd.ca/diner/ . It demonstrates the public menu and cart, a protected restaurant manager board, a driver test console and private customer order tracking.

## Install

Download [dyws.zip](https://github.com/Starlit-Digital/dyws/blob/main/dyws.zip?raw=true), or clone this repo and run `composer install --no-dev`. Serve only public_html, then open `/setup/`. The wizard checks the server, creates your administrator and private storage, and removes itself. See [installation and upgrades](INSTALL.md).

Orders and accounts use SQLite. Overall site settings and the catalog remain JSON. Existing driver credentials migrate without password resets.

## Reporting plugins

The Reports page includes the bundled Order Reporting dashboard: period comparisons, payment and order charts, popular items, fulfilment, turnaround times, CSV and SVG exports. DataTables is a separate bundled plugin for table search, sorting and pagination. Both can be disabled independently in Admin → Plugins. See [report definitions and plugin integration](docs/order-reporting.md).

## What works

Orders persist in SQLite. The server validates product IDs, variants and quantities, calculates prices and tax in integer cents, and handles idempotent submissions. Business managers accept and prepare orders, assign drivers and inspect operational reports, test payment totals, refunds, fees, tax, popular items and CSV exports. Drivers see assigned deliveries and can update their status and automatically share browser GPS during active deliveries. A simulated route is included for testing without sharing a real person’s location.

Checkout opens a private order status page. Google Maps shows the driver, destination and driving route. Completed deliveries stop sharing location. The demo currently uses a simulated Manning Town Centre origin. HTTPS polling is active; optional WebSocket plumbing is ready for a separate server.

No real payments are collected and no real deliveries are dispatched. Payments use a manual test ledger or optional Stripe sandbox Checkout. iOS and Android apps are planned in the mobile document, not built yet.

## Run

```sh
composer install
npm run setup
npm run serve
npm test
```

Open http://127.0.0.1:8097 . PHP 8.1 or newer with PDO SQLite is required. Node.js and Python 3 run the tests. Composer installs the pinned Stripe PHP SDK. Only public_html is a web root. Private access details are in ignored var files; see deployment instructions.

## Project guide

- [Product notes and naming research](docs/product-notes.md)
- [Backend architecture and reporting definitions](docs/architecture.md)
- [HTTP API](docs/api.md)
- [iOS and Android driver app plan](docs/mobile-driver-plan.md)
- [Local setup, hosted demo and validation](docs/deployment.md)
- [Starlit Diner example](examples/starlit-diner/README.md)

The reusable browser module is in public_html/dyws, and the private PHP library is in modules/dyws/php. See [module integration and PHP rendering calls](docs/dyws-module.md). Supply a catalog URL and an order adapter. The diner adapter uses the same origin API; another restaurant integration must provide its own authenticated tenant configuration and narrowly configured origin policy. Styles are part of the dyws package with scoped dyws classes and --dyws theme variables. See [dyws styling](docs/dyws-styles.md).

The repository was renamed from restaurant-ordering, then starlit-go, to dyws while preserving its Git history. The original Cravings & Delight website remains separately saved at https://github.com/Starlit-Digital/cravingsanddelight.ca .

## Product catalogs and payments

dyws now supports general products, services sold in whole units and food. Open [Catalog and payments](https://sltd.ca/diner/settings/) from the business admin. The private server JSON supplies the storefront and authoritative prices. See [catalog and Stripe setup](docs/catalog-and-payments.md) and the [general store example](examples/general-store/catalog.json).

Run `composer install` before setup or tests. The Stripe connector uses hosted Checkout and signed payment webhooks. Sandbox credentials are entered in admin settings; live keys are intentionally unavailable in this demonstration. Payments are disabled until configured. The product display name is configurable; “Do You Want Something?” is the expanded name of dyws.

The current demo uses `<dyws-ordering>`. The older element names remain compatible. CSS entry point: `public_html/dyws/dyws.css`; shadow cart styles: `public_html/dyws/ordering.css`.

## Administration

Open [Orders](https://sltd.ca/diner/orders/) and use the shared navigation for Orders, Reports, Catalog, Drivers, Password, Settings and Plugins. The catalog editor provides category and item fields with a Save catalog action backed by the private JSON file. Drivers can be added, renamed, reset or deactivated. Password changes require the current admin password and sign out admin sessions. Images currently use existing paths or HTTPS URLs.

The admin Settings tab lets businesses rename the assignment role using singular and plural display names. Driver and Drivers remain the defaults. Custom labels also appear in the team console and customer tracking; authorization stays unchanged.

Optional features use the [dyws plugin system](docs/plugins.md). Google Maps is bundled as a plugin, with activation in Admin → Plugins. Plugin settings stay private JSON and survive deactivation.

The bundled Stripe and Google Maps plugins own their integrations and settings. Admin → Plugins manages activation, with a Settings link for each configured plugin. Stripe remains sandbox only. The [25 hook features](docs/plugin-hooks.md) let plugins add validation, fields, views, searches, reports and order handling. A complete gift note example is included under examples/plugins/gift-note.

Administrator entry: `/admin/`. PHP redirects signed out visitors to `/auth/` before sending admin markup. Successful sign in always opens `/orders/`. The standalone sign in page has no admin header, navigation or live update footer.
