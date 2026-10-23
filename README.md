# Starlit Go

Product ordering and delivery infrastructure for a business’s own website. Your website. Your orders. Delivered.

Private repository: https://github.com/Starlit-Digital/starlit-go

Starlit Diner is the fictional example at https://sltd.ca/diner/ . It demonstrates the public menu and cart, a protected restaurant manager board, a driver test console and customer status and GPS tracking on the original page.

## What works

Orders persist in SQLite. The server validates product IDs, variants and quantities, calculates prices and tax in integer cents, and handles idempotent submissions. Business managers accept and prepare orders, assign drivers and inspect operational reports, test payment totals, refunds, fees, tax, popular items and CSV exports. Drivers see assigned deliveries and can update their status or explicitly share browser GPS. A simulated route is included for testing without sharing a real person’s location.

The customer stays on the menu page after checkout. An expiring private tracking link powers an inline status timeline and approximate driver position on the Manning area reference map. Completed deliveries stop sharing location. The map is a demonstration projection, not navigation or an arrival estimate.

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

The reusable browser module is in public_html/dyws, and the private PHP library is in modules/dyws/php. See [module integration and PHP rendering calls](docs/dyws-module.md). Supply a catalog URL and an order adapter. The diner adapter uses the same origin API; another restaurant integration must provide its own authenticated tenant configuration and narrowly configured origin policy. Styles are part of the DYWS package with scoped dyws classes and --dyws theme variables. See [DYWS styling](docs/dyws-styles.md).

The repository was renamed from restaurant-ordering while preserving its Git history. The original Cravings & Delight website remains separately saved at https://github.com/Starlit-Digital/cravingsanddelight.ca .

## Product catalogs and payments

Starlit Go now supports general products, services sold in whole units and food. Open [Catalog and payments](https://sltd.ca/diner/settings.html) from the business admin. The private server JSON supplies the storefront and authoritative prices. See [catalog and Stripe setup](docs/catalog-and-payments.md) and the [general store example](examples/general-store/catalog.json).

Run `composer install` before setup or tests. The Stripe connector uses hosted Checkout and signed payment webhooks. Sandbox credentials are entered in admin settings; live keys are intentionally unavailable in this demonstration. Payments are disabled until configured. The product display name is configurable; “Do You Want Something?” is the current name candidate, not a repository rename.

The current demo uses `<dyws-ordering>`. The older element names remain compatible. CSS entry point: `public_html/dyws/dyws.css`; shadow cart styles: `public_html/dyws/ordering.css`.
