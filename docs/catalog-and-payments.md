# Generic catalog and payment extensions

dyws means Do You Want Something? and is the confirmed product name. `platformName` configures the product display label and `businessName` identifies the business. The fictional diner keeps its own branding.

## Catalog

The authoritative catalog is `var/catalog.json`, outside the web root. Initial examples live in `examples/starlit-diner/catalog.json` and `examples/general-store/catalog.json`. `GET /catalog` returns validated active products to the storefront. The generic `<dyws-ordering>` component consumes that endpoint.

| Field | Meaning |
| --- | --- |
| schemaVersion | 2 |
| businessName, platformName | Business identity and editable product name |
| currency | CAD or USD, fixed per deployment |
| taxBasisPoints | Configured flat example rate, 500 means 5% |
| deliveryFee | Integer cents, used by both cart and server |
| pickupAddress | Pickup text for this business |
| businessPhone, businessEmail | Optional public contact details, edited under Settings |
| itemOrderCap | Whole number from 1 to 99, default 10. Maximum quantity of one product across all its variants per order, enforced by the server |
| categories | Groups with stable id, name, optional image and items |
| items[].id | Stable unique product identifier |
| sku | Optional business SKU |
| name, description | Plain text product details |
| image | Optional object containing src and alt |
| price | Integer cents, 1295 means 12.95 |
| active | Whether customers can order the product |
| unit | Display description such as each, box or hour |
| optionLabel, variants | Optional named choices with stable IDs and integer prices |
| metadata | Optional public named scalar attributes, never private data |

All quantities are whole units. Availability is a switch, not stock reservation. Images are URLs or relative paths, not uploaded binaries. Supported currencies use two decimal places. Real inventory, shipping calculations, digital fulfillment and jurisdiction based tax rules are separate work.

Admin opens `catalog/`, edits categories and items and saves. The API validates before replacing the private file atomically. Revision checks prevent a stale editor from overwriting another save. Order lines snapshot names, descriptions, SKUs, images, options and prices; later edits do not rewrite old orders. A new order always uses the private server prices and delivery fee.

## Payment extensions

DYWS supports payment plugins. Stripe is not included in the public repository, install kit or fictional Starlit Diner. A compatible Stripe plugin must be installed separately with its own dependencies and configured account. Starlit maintains its private additions independently for managed deployments under separate customer agreements.

The included ledger records demonstration captures and refunds. The bundled Square, PayPal, Helcim, Clover, Moneris and Authorize.net connectors are sandbox integration foundations; activating them does not enable customer checkout. See [payment connectors](payment-connectors.md).

A payment plugin selects a provider through the documented [plugin interface](plugins.md). Core snapshots the provider and currency on each order, preserves authoritative prices and prevents manual test actions from changing online provider payments. Browser redirects never confirm a payment. Provider integrations must verify signatures, tenant, order, attempt, amount, currency, payment state and idempotency before reconciling the ledger.

Existing orders and payment records survive the removal of a plugin from the distribution. Preserve installed payment plugins, their dependencies, encrypted settings and callbacks during upgrades until outstanding attempts and refunds are settled. Missing active payment plugins reject new orders instead of silently switching to manual payment. Historical Stripe table names remain supported for data migration.

The earlier Stripe implementation supported merchant owned sandbox Checkout only. It did not implement Stripe Connect, live processing, platform commissions or driver payouts. Historical code in Git does not change the contents of the current kit. The separate plugin owns its setup instructions and integration tests.

## Verification

The framework suite covers catalog authorization, revisions, nonfood products, inactive items, authoritative pricing, quantity limits and operation without Stripe. Payment extension tests cover absent provider handling, blocked manual capture, protected fulfillment, pending tracking and historical payment migration. Each separately installed plugin must also pass its own integration tests.
