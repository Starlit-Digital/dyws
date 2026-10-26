# dyws product direction

dyws means **Do You Want Something?** The confirmed product and repository name is lowercase dyws. The current application version is recorded in [VERSION](../VERSION). The public repository is [Starlit-Digital/dyws](https://github.com/Starlit-Digital/dyws).

## Product

dyws adds ordering and delivery to a business's own website. The customer shops and tracks an order, the business manages fulfillment, and an assigned driver handles delivery. Catalogs support generic products and services sold in whole units, not only food.

Starlit Diner is the fictional reference host at `https://dyws.ca/`. Its five categories, 35 items, generated food images and diner exterior demonstrate integration. The diner name and theme belong to the example, not the reusable platform.

Working line: Your website. Your orders. Delivered.

## Product domain, October 24, 2026

The owner registered `dyws.ca` at Namecheap and requested it on the existing Hostinger shared hosting account. Its PHP/HTML website was created on the Premium Web Hosting plan. The owner clarified that DNS stays at Namecheap, matching the other domains: use Namecheap BasicDNS, with `A @` pointing to Hostinger's `191.101.13.124` and `CNAME www` pointing to `dyws.ca`, both with a 300 second TTL. Do not switch this domain to Hostinger nameservers.

This setup reserves the product's own web address and hosting space. It now contains the isolated Starlit Diner public test running DYWS 0.11.1, with public DNS and HTTPS still pending. The existing product page at `https://sltd.ca/dyws/` and diner examples remain in place. See [domain hosting details and verification status](deployment.md#dywsca-hosting-october-24-2026).

## Starlit Business Related and SiteCraft

DYWS is listed under Business Related on sltd.ca, including the homepage, Projects page and existing footer links, following the owner’s October 25 direction. Its role is the reusable ordering and delivery platform behind suitable business websites.

Starlit SiteCraft is the public website service. The workflow selects a Starlit template, applies Starlit assets and accessibility preferences, adds appropriate DYWS capabilities, customizes the site, verifies it and deploys it. Use DYWS where ordering, fulfillment, delivery or its plugin capabilities are needed. A static design or email contact form does not by itself integrate DYWS.

Create an appropriately named private Starlit Digital repository for each distinct client site. Reuse that site's repository for additional pages and preserve existing remotes and edits. Keep the reusable platform here and client branding in the owning site. The [SiteCraft landing page](https://sltd.ca/sitecraft/) omits pricing and invites contact for an initial meeting.

The reusable workflow lives in `~/.codex/skills/starlit-sitecraft/SKILL.md`. Durable website and workflow decisions live in `sltd.ca/docs/AI_NOTES_WEBSITE.txt` under the shared repository base. Missing contact details, deployment configuration and incomplete integrations must remain explicit.

## Current implementation

- Reusable PHP menu, category and item rendering, browser modules, a cart component and scoped CSS. Host pages supply branding, placement and endpoints.
- Private JSON catalogs with categories, images, descriptions, prices, SKU, unit, availability and variants. Settings owns business details; Catalog owns items and categories.
- SQLite orders, accounts, sessions, payment ledger, events and active GPS. Server pricing, idempotency, tenant scope and guarded status transitions remain authoritative.
- Seven protected admin pages: Orders, Reports, Catalog, Drivers, Password, Settings and Plugins. `/admin/` is the entry, `/auth/` handles sign in and Orders is the default.
- A driver console with assigned addresses, pickup and completion actions, and automatic GPS for active deliveries. A private simulated origin is available for test deployments.
- A dedicated private customer status page after checkout. Google Maps can show driver and destination markers, a traffic aware route and an approximate arrival time. Completion comes only from backend status.
- Bundled Google Maps, Order Reporting, DataTables, Installation Lockdown, Order Format, Nominatim Address Lookup and six independent sandbox payment connector foundations. The plugin API has 40 hook contracts, namespaced routes, providers, validators, filters and actions. PHP feature attributes select browser assets per page. Plugin categories and individual Edit pages organize their configuration.
- Business location rows and immutable pickup details on new orders, with compatibility for older single address catalogs. Drivers manage their own vehicle model, colour and map icon through revision checked profile saves.
- Optional address suggestions from an owned Nominatim service with Alberta civic address supplementation. Manual entry remains available. Suggestions do not establish delivery eligibility, and the public demo uses fictional local results.
- PHP initial data, skeletons, HTTPS polling, optional WebSocket plumbing and refresh on tab return. Admin guards preserve unsaved edits and server revisions.
- UTC storage and a selectable display timezone. Reports include comparisons, charts, CSV and SVG exports, with definitions separating ordered value from test collections.
- Git plus Composer as the primary installation path. The optional ZIP is a release download. Browser setup verifies a private ownership key, creates the admin account and removes itself.

## Configurable roles and presentation

Businesses can rename Driver and Drivers using arbitrary singular and plural labels. This changes display text, not permissions or API roles. The diner uses the default labels. dyws CSS classes and theme tokens remain independent of the diner palette.

The public kit does not include Stripe. It supports separately installed payment plugins; Starlit private additions and managed service agreements are separate from the framework and example diner. Plugin settings belong to their plugins and survive deactivation. A separately installed Stripe plugin's signed callbacks can reconcile existing sandbox attempts after deactivation; new Checkout requests stop. GPS capture, authentication and the order state machine remain core features.

## Work still needed for a commercial pilot

1. Business hours, delivery zones, address validation, preparation estimates, kitchen notifications and robust inventory requirements.
2. Add named administrator and device accounts, stronger session management, production payment enablement, tips, discounts and operational refund workflows. Sandbox Checkout and webhook reconciliation already exist; payouts and marketplace settlement do not.
3. Native iOS and Android driver apps, secure device storage, reliable background GPS, offline recovery and physical device testing.
4. Dispatch offers, capacity rules, acceptance races and route planning beyond manually ordered delivery runs.
5. Durable queues and outbox, notifications, monitoring, load tests, deployment automation, scheduled cleanup, backups and restore drills. Review database capacity before expanding beyond a small pilot.

The current build is a demonstration. Manual payment actions create test ledger entries; the separate Stripe plugin accepts sandbox keys only and is not included. No real driver is dispatched, and native apps have not been built. See the [complete feature breakdown](../README.md) and [driver app plan](mobile-driver-plan.md).
