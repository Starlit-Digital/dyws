# Starlit Go product notes

Recorded October 23, 2026 from the owner’s direction.

## Product

Starlit Go is a restaurant ordering and delivery platform sold as an addition to a restaurant’s own website. It connects three surfaces: the customer’s menu and order tracking page, restaurant management, and the delivery driver. The customer stays on the restaurant website after checkout and sees status updates and the driver’s latest position there.

Working line: Your website. Your orders. Delivered.

Starlit Diner is the fictional reference restaurant, not the product name. Its 35 example items, five categories, original generated food imagery, fictional Edmonton address and diner exterior remain the demonstration. Cravings & Delight remains separately archived in its own private repository and is not converted into this platform.

The existing private restaurant-ordering repository was renamed to Starlit-Digital/starlit-go, preserving its history. Local checkout: /private/var/www/starlit-digital/starlit-go. Demo stays at https://sltd.ca/diner/ .

## Names and domains

Names considered: Starlit Orders, Starlit Go, Starlit Direct, Starlit Delivery, Starlit Dash. Starlit Go was preferred for the broader platform; Dash felt too close to DoorDash.

Preliminary registry checks on October 23, 2026 returned no registration record for starlitgo.com, starlitgo.ca, starlitdirect.com, starlitdirect.ca, starlitorders.com, starlitorders.ca, starlitdelivery.com, starlitdelivery.ca, starlitdash.com and starlitdash.ca. getstarlit.com was registered. These were preliminary checks, not purchase confirmation or trademark clearance. No domain has been purchased.

## Foundation delivered

Persistent SQLite orders with tenant identifiers, authoritative catalog pricing, integer cent totals, request idempotency, immutable status events, manager status workflow, driver assignment, separate test payment capture and full refund ledger, order totals, average order value, top items, paid collections, tax and fee breakdown, date filtering in Edmonton time, observed preparation and delivery durations, CSV report export, role scoped manager and driver sessions, and customer tracking links that expire after 24 hours.

Customers choose pickup or delivery in the example checkout. Delivery has a fixed $3.95 demonstration fee. The driver console has an explicit browser GPS sharing action and a simulated test route. Only the assigned driver can update an active delivery. Customer tracking polls the same API, displays a timeline and an approximate marker over the Manning area reference map. It shows a stale warning after 60 seconds and hides locations older than 15 minutes. Terminal orders delete their stored position.

## Next commercial milestones

1. Restaurant pilot with proper user accounts, per restaurant menus and configuration, business hours, availability, delivery zones, address validation, preparation estimates and kitchen notifications.
2. Real payment integration, server verified webhooks, payment reconciliation, refunds, tips, discounts, payouts and fee agreements. Test ledger entries are not actual charges.
3. Native iOS and Android driver apps with secure device authentication, assignment offers, acceptance, pickup, location sharing, delivery completion and offline recovery.
4. Live map provider adapter with contractual usage rights, routable coordinates and ETAs. The current reference map is a demo projection, not navigation.
5. Platform operations: PostgreSQL migration, queue and outbox, push notifications, dispatch tools, support workflows, backups and restore drills, monitoring, deployment automation and load testing.

Do not call the platform production ready. No actual money is moved and no drivers are dispatched. Native apps are planned, not built in this foundation.

## Generic ordering direction

The owner requested server JSON products with name, image, description and price, suitable for any business, plus admin managed Stripe credentials. The platform now has validated product JSON, SKU, unit, availability, options and public metadata; an authenticated editor; and sandbox Stripe Checkout with signed webhook reconciliation. “Do You Want Something?” is the exact novelty name candidate. Keep the repository name Starlit Go pending a confirmed rename. There is no requested governor feature; that wording meant “just go from there.”

## DYWS presentation boundary

The owner requested a separate CSS system named DYWS, short for Do You Want Something. Reusable catalog, cart, admin and tracking presentation now lives in public_html/dyws with dyws class names and theme tokens. The diner remains a host example. Driver trip, admin, backend and installer runtime packages are ideas for later, not part of this CSS extraction.
