# dyws product notes

Recorded October 23, 2026 from the owner’s direction.

## Product

dyws is a restaurant ordering and delivery platform sold as an addition to a restaurant’s own website. It connects three surfaces: the customer’s menu and order tracking page, restaurant management, and the delivery driver. The customer stays on the restaurant website after checkout and sees status updates and the driver’s latest position there.

Working line: Your website. Your orders. Delivered.

Starlit Diner is the fictional reference restaurant, not the product name. Its 35 example items, five categories, original generated food imagery, fictional Edmonton address and diner exterior remain the demonstration. Cravings & Delight remains separately archived in its own private repository and is not converted into this platform.

The existing private restaurant-ordering repository was renamed to Starlit-Digital/starlit-go, preserving its history. The owner subsequently renamed it to Starlit-Digital/dyws. Local checkout: /private/var/www/starlit-digital/dyws. Demo stays at https://sltd.ca/diner/ .

## Names and domains

Names considered originally: Starlit Orders, Starlit Go, Starlit Direct, Starlit Delivery, Starlit Dash. Starlit Go was initially preferred for the broader platform; Dash felt too close to DoorDash.

Preliminary registry checks on October 23, 2026 returned no registration record for starlitgo.com, starlitgo.ca, starlitdirect.com, starlitdirect.ca, starlitorders.com, starlitorders.ca, starlitdelivery.com, starlitdelivery.ca, starlitdash.com and starlitdash.ca. getstarlit.com was registered. These were preliminary checks, not purchase confirmation or trademark clearance. No domain has been purchased.

## Foundation delivered

Persistent SQLite orders with tenant identifiers, authoritative catalog pricing, integer cent totals, request idempotency, immutable status events, manager status workflow, driver assignment, separate test payment capture and full refund ledger, order totals, average order value, top items, paid collections, tax and fee breakdown, date filtering in Edmonton time, observed preparation and delivery durations, CSV report export, role scoped manager and driver sessions, and customer tracking links that expire after 24 hours.

Customers choose pickup or delivery in the example checkout. Delivery has a fixed $3.95 demonstration fee. The driver console automatically starts browser GPS during active deliveries, with a fixed test origin configured for this demo. Only the assigned driver can update an active delivery. Customer tracking polls the same API and displays a timeline, Google map and driving route on a private status page. It shows a stale warning after 60 seconds and hides locations older than 15 minutes. Terminal orders delete their stored position.

## Next commercial milestones

1. Restaurant pilot with proper user accounts, per restaurant menus and configuration, business hours, availability, delivery zones, address validation, preparation estimates and kitchen notifications.
2. Real payment integration, server verified webhooks, payment reconciliation, refunds, tips, discounts, payouts and fee agreements. Test ledger entries are not actual charges.
3. Native iOS and Android driver apps with secure device authentication, assignment offers, acceptance, pickup, location sharing, delivery completion and offline recovery.
4. Add preparation and travel estimates to the existing Google Maps route display.
5. Platform operations: PostgreSQL migration, queue and outbox, push notifications, dispatch tools, support workflows, backups and restore drills, monitoring, deployment automation and load testing.

Do not call the platform production ready. No actual money is moved and no drivers are dispatched. Native apps are planned, not built in this foundation.

## Generic ordering direction

The owner requested server JSON products with name, image, description and price, suitable for any business, plus admin managed Stripe credentials. The platform now has validated product JSON, SKU, unit, availability, options and public metadata; an authenticated editor; and sandbox Stripe Checkout with signed webhook reconciliation. “Do You Want Something?” is the exact novelty name candidate. Keep the repository name dyws pending a confirmed rename. There is no requested governor feature; that wording meant “just go from there.”

## dyws presentation boundary

The owner requested a separate CSS system named dyws, short for Do You Want Something. Reusable catalog, cart, admin and tracking presentation now lives in public_html/dyws with dyws class names and theme tokens. The diner remains a host example. Driver trip, admin, backend and installer runtime packages are ideas for later, not part of this CSS extraction.

The owner requested JavaScript and PHP extraction into dyws. Host pages now include the private PHP module and call full menu, category or item render functions. Browser modules add cart behavior to those selected panels. Public assets and private backend code are separated for deployment.

The owner requested administration tabs with separate pages for the reports dashboard, catalog editor, drivers, Stripe settings and admin password changes. The first catalog editor exposes structured fields backed by the existing private JSON, with category/item/option management and a single Save catalog action. The controls and services remain in dyws modules; the host owns page links and layout.

## Configurable role naming, October 23, 2026

dyws now has a basic Admin Settings page. Businesses can rename Driver and Drivers using their own singular and plural terms, such as Handler and Handlers or Admin and Admins. The name appears in account management, admin navigation, order assignments, the team console, storefront console link and customer tracking. Existing accounts and permissions are preserved. The demo keeps Driver as its default.

## Confirmed name and simpler administration

The owner confirmed lowercase dyws on October 23, 2026. The private GitHub repository and package metadata use this name. A compact shared admin header links back to the diner through its D monogram. Repeated introductions are removed, setup guidance is expandable, and all six pages retain accessible labels and full size controls.

## Installer and durable storage

The project ships a single dyws.zip for installation, with Git clone as an alternative. The /setup wizard checks hosting, verifies a private one time ownership key, collects the business name, URL and admin password, creates private storage, then removes itself. Existing configuration blocks repeat setup. Orders already used SQLite and remain there; driver accounts and admin password hashes now use SQLite too. Overall site settings and product catalogs remain JSON. Legacy account migration preserves credentials, driver IDs, assignments, active state and sessions.
