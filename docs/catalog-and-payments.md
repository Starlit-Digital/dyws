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
| optionGroups | Ordered customization groups with choice surcharges and minimum and maximum counts |
| metadata | Optional public named scalar attributes, never private data |

All quantities are whole units. Availability is a switch, not stock reservation. Images are URLs or relative paths, not uploaded binaries. Supported currencies use two decimal places. Real inventory, shipping calculations, digital fulfillment and jurisdiction based tax rules are separate work.

Admin opens `catalog/`, edits categories and items and saves. The API validates before replacing the private file atomically. Revision checks prevent a stale editor from overwriting another save. Order lines snapshot names, descriptions, SKUs, images, options and prices; later edits do not rewrite old orders. A new order always uses the private server prices and delivery fee.

## Item customization

`examples/pizza/catalog.json` shows a pizza with existing size variants plus crust and topping groups. In the catalogue editor, open an item and use **Add customization group**. Each group has a stable `id`, a display `name`, integer `min` and `max`, and a `choices` list. Each choice has a stable `id`, display `name` and nonnegative integer `price` in cents. The price is added to the selected size price, or the item price when there are no variants. Prices apply once per selected choice per pizza, then multiply by quantity.

Set `min: 2, max: 2` for exactly two choices, `min: 0, max: 3` for up to three, or `min: 1, max: 2` for one to two. A group allows at most 50 choices, with limits within the available choice count. An item allows at most 20 groups. Group IDs must be unique within an item, and choice IDs within a group. Group and choice order follows the catalogue. Existing items without groups retain their current ordering behaviour.

Customizable menu cards expand in place. They show the size, groups, selection rules, individual surcharges, updated unit price and quantity controls. Required choices must be completed before adding. Checkbox groups disable unselected choices at their maximum. Optional single choice groups provide a None choice. Different combinations remain separate cart lines, while identical combinations share a quantity. The item quantity cap covers all combinations.

Order requests add an optional `selections` object to each line, mapping group IDs to lists of choice IDs:

```json
{"id":"pizza","variant":"large","quantity":1,"selections":{"crust":["stuffed"],"toppings":["pepper","cheese"]}}
```

The server rejects unknown groups or choices, repeated choices and selections outside the group limits. It ignores submitted prices, calculates the surcharge from the private catalogue, and canonicalizes choice order when checking duplicate lines and idempotency. Saved carts are also repriced and validated. Order snapshots retain the canonical selections and include group names and choice names in `option`, so existing receipts, kitchen orders and printing retain the full customization description.

Deployment requires the PHP catalogue validator, order processing and renderer together with the JavaScript and catalogue CSS. Update application assets using the normal upgrade procedure and refresh cached assets. No database migration or merchant catalogue replacement is needed. Add groups through the editor or merge them deliberately into the private catalogue. The pizza example is a seed only.

## Payment extensions

DYWS supports payment plugins. Stripe is not included in the public repository, install kit or fictional Starlit Diner. A compatible Stripe plugin must be installed separately with its own dependencies and configured account. Starlit maintains its private additions independently for managed deployments under separate customer agreements.

The included ledger records demonstration captures and refunds. The bundled Square, PayPal, Helcim, Clover, Moneris and Authorize.net connectors are sandbox integration foundations; activating them does not enable customer checkout. See [payment connectors](payment-connectors.md).

A payment plugin selects a provider through the documented [plugin interface](plugins.md). Core snapshots the provider and currency on each order, preserves authoritative prices and prevents manual test actions from changing online provider payments. Browser redirects never confirm a payment. Provider integrations must verify signatures, tenant, order, attempt, amount, currency, payment state and idempotency before reconciling the ledger.

Existing orders and payment records survive the removal of a plugin from the distribution. Preserve installed payment plugins, their dependencies, encrypted settings and callbacks during upgrades until outstanding attempts and refunds are settled. Missing active payment plugins reject new orders instead of silently switching to manual payment. Historical Stripe table names remain supported for data migration.

The earlier Stripe implementation supported merchant owned sandbox Checkout only. It did not implement Stripe Connect, live processing, platform commissions or driver payouts. Historical code in Git does not change the contents of the current kit. The separate plugin owns its setup instructions and integration tests.

## Verification

The framework suite covers catalog authorization, revisions, nonfood products, inactive items, authoritative pricing, quantity limits and operation without Stripe. Payment extension tests cover absent provider handling, blocked manual capture, protected fulfillment, pending tracking and historical payment migration. Each separately installed plugin must also pass its own integration tests.

## Customer deals and deferred payment

See [deals and payment choices](deals-and-payment-choices.md) for the optional
restaurant settings, scheduled offer types, customer wallet, single use claims,
pricing and reporting definitions, provider compatibility and migration contract.
