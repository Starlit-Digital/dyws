# dyws product direction

dyws means **Do You Want Something?** The confirmed product and repository name is lowercase dyws. The current application version is recorded in [VERSION](../VERSION). The private repository is [Starlit-Digital/dyws](https://github.com/Starlit-Digital/dyws).

## Product

dyws adds ordering and delivery to a business's own website. The customer shops and tracks an order, the business manages fulfillment, and an assigned driver handles delivery. Catalogs support generic products and services sold in whole units, not only food.

Starlit Diner is the fictional reference host at `https://sltd.ca/diner/`. Its five categories, 35 items, generated food images and diner exterior demonstrate integration. The diner name and theme belong to the example, not the reusable platform.

Working line: Your website. Your orders. Delivered.

## Current implementation

- Reusable PHP menu, category and item rendering, browser modules, a cart component and scoped CSS. Host pages supply branding, placement and endpoints.
- Private JSON catalogs with categories, images, descriptions, prices, SKU, unit, availability and variants. Settings owns business details; Catalog owns items and categories.
- SQLite orders, accounts, sessions, payment ledger, events and active GPS. Server pricing, idempotency, tenant scope and guarded status transitions remain authoritative.
- Seven protected admin pages: Orders, Reports, Catalog, Drivers, Password, Settings and Plugins. `/admin/` is the entry, `/auth/` handles sign in and Orders is the default.
- A driver console with assigned addresses, pickup and completion actions, and automatic GPS for active deliveries. A private simulated origin is available for test deployments.
- A dedicated private customer status page after checkout. Google Maps can show driver and destination markers, a traffic aware route and an approximate arrival time. Completion comes only from backend status.
- Four bundled plugins: Google Maps, Stripe sandbox Checkout, Order Reporting and DataTables. The plugin API has 32 hook contracts, namespaced routes, providers, validators, filters and actions. PHP feature attributes select browser assets per page.
- PHP initial data, skeletons, HTTPS polling, optional WebSocket plumbing and refresh on tab return. Admin guards preserve unsaved edits and server revisions.
- UTC storage and a selectable display timezone. Reports include comparisons, charts, CSV and SVG exports, with definitions separating ordered value from test collections.
- Git plus Composer as the primary installation path. The optional ZIP is a release download. Browser setup verifies a private ownership key, creates the admin account and removes itself.

## Configurable roles and presentation

Businesses can rename Driver and Drivers using arbitrary singular and plural labels. This changes display text, not permissions or API roles. The diner uses the default labels. dyws CSS classes and theme tokens remain independent of the diner palette.

Plugin settings belong to their plugins and survive deactivation. Stripe's signed callbacks can reconcile existing sandbox attempts after deactivation; new Checkout requests stop. GPS capture, authentication and the order state machine remain core features.

## Work still needed for a commercial pilot

1. Business hours, delivery zones, address validation, preparation estimates, kitchen notifications and robust inventory requirements.
2. Add named administrator and device accounts, stronger session management, production payment enablement, tips, discounts and operational refund workflows. Sandbox Checkout and webhook reconciliation already exist; payouts and marketplace settlement do not.
3. Native iOS and Android driver apps, secure device storage, reliable background GPS, offline recovery and physical device testing.
4. Dispatch offers, capacity rules, acceptance races and route planning beyond the current single active delivery view.
5. Durable queues and outbox, notifications, monitoring, load tests, deployment automation, scheduled cleanup, backups and restore drills. Review database capacity before expanding beyond a small pilot.

The current build is a demonstration. Manual payment actions create test ledger entries; Stripe accepts sandbox keys only. No real driver is dispatched, and native apps have not been built. See the [complete feature breakdown](../README.md) and [driver app plan](mobile-driver-plan.md).
