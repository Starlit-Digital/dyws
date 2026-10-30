# Catalog, fulfillment and booking plugin contracts

## Ownership

Catalog owns catalog browsing and authoring routes, cart item selection and option pricing. Pickup owns scheduled collection, availability and its checkout browser controller. Delivery owns delivery fulfillment selection and dispatch run commands. Appointment Booking owns service configuration, availability, reservations, cancellation and appointment administration.

Core retains authentication, tenant scope, the neutral catalog data contract, integer cent totals, order persistence, payment ledgers, transition integrity, historical fulfillment snapshots and dispatch projections. Removing optional plugin code must not prevent health checks or reading existing order receipts. Plugin deactivation retains settings and records.

The standard bundle activates Catalog, Pickup and Delivery for new ordering installations. Existing installations adopt these three once through `upgradeDefaults`. Later deliberate deactivations persist. Booking starts inactive. A booking installation can activate Booking without Catalog, Pickup or Delivery.

## Required business operations

A registration context exposes `$plugin->provideOperation($name, $handler)`. Core calls `$plugins->invoke($pluginId, $operation, ...$arguments)` for required work. This is distinct from optional observation hooks and filters. Disabled capabilities reject with 409. Missing or broken active implementations reject with 503. An operation never silently falls back to core behavior.

| Plugin | Operation | Arguments | Result |
| --- | --- | --- | --- |
| catalog | `cart.price` | validated catalog, submitted item selections | canonical lines and subtotal in cents |
| pickup | `schedule.normalize` | submitted pickup schedule or null | normalized schedule or null |
| pickup | `fulfillment.create` | schedule, business timezone, location ID, location policy | immutable fulfillment snapshot |
| delivery | `schedule.normalize` | submitted schedule | null, rejecting scheduled pickup fields |
| delivery | `fulfillment.create` | null, business timezone, location ID, location policy | immutable delivery snapshot |
| delivery | `run.create` | active driver ID, ordered order IDs, idempotency key | dispatch run |

The runtime can be injected through `Store::$plugins`. Embedded trusted callers use the bundled runtime through `Store::businessPlugins()` when no runtime has been injected. Optional plugin files are discovered by the existing plugin loader. Core does not directly require their implementations.

Catalog and pickup preserve their existing API paths through host approved route aliases. Delivery owns `POST /manager/runs`, `POST /manager/runs/{runId}`, and driver run start and location routes. Route access roles, rate limits and tenant checks remain enforced. Core still permits safe completion and historical viewing of existing orders after deactivation.

`GET /catalog` includes `fulfillmentModes`, containing only active fulfillment modes. Checkout hides unavailable options and core repeats the capability check when orders are submitted. Saved delivery details cannot switch checkout to a disabled delivery mode. Public and manager catalog API routes are unavailable when Catalog is inactive.

The pickup browser module provides `checkout.pickup`. The storefront page manifest consumes that feature, and checkout receives its controller through the browser plugin host. Generic cart, order and historical presentation components remain reusable under `public_html/dyws`.

## Appointment Booking API

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/plugins/booking/services` | public | service names, durations, resource identifiers, timezone and hours |
| POST | `/plugins/booking/availability` | public | date and service slot lookup |
| POST | `/plugins/booking/reserve` | public | idempotent confirmed reservation |
| POST | `/plugins/booking/cancel` | appointment token | cancellation before the appointment starts |
| GET, POST | `/manager/plugins/booking/settings` | manager | configuration with revision checks |
| GET, POST | `/manager/plugins/booking/appointments` | manager | list appointments, cancel or mark ended appointments complete |

Availability accepts `{serviceId, date}`, where date is `YYYY-MM-DD` in the business timezone. Dates span today through 90 days ahead. Start times use quarter hours with at least 30 minutes lead time. Hours are a same day opening and closing window plus enabled weekdays. Closed days return no slots. Nonexistent and repeated local times are rejected. Overnight appointment hours, calendar synchronization, reminders and appointment payments are not implemented.

Reservation accepts `{serviceId, startsAt, customer: {name, phone}, acknowledged: true, idempotencyKey}`. `startsAt` is an integer Unix timestamp from the server availability response. The server rechecks availability inside `BEGIN IMMEDIATE`; competing processes cannot reserve the same resource interval. Every service has a `resource` code, default `main`, so distinct services sharing a staff member or room also conflict. Different tenants remain independent.

A reservation response includes the appointment ID, service ID and name, start and end timestamps, business timezone, status and cancellation token. Only the accepted request key reproduces that receipt. Reusing a key with changed input returns 409. Accepted retries remain valid after service removal, cancellation or a configuration change. Service name, duration, resource and timezone are snapshots; configuration edits do not rewrite accepted appointments.

Public cancellation accepts `{id, token}` and never exposes another customer's contact data. Invalid IDs and tokens return the same 404 response. Repeated cancellation is safe. Manager updates accept `{id, status}`, where status is `cancelled` or `completed`. Completion requires the appointment end time to have passed. No operation reopens a completed or cancelled appointment.

Settings accept `{revision, settings: {timeZone, services, days, openMinute, closeMinute}}`. A service contains `{id, name, duration, resource}`. IDs and resource codes are stable lowercase identifiers. Duration is 15 through 480 minutes in quarter hour increments. Settings are stored in a tenant specific private JSON file with restrictive permissions, atomic replacement and revision checks. A database lock serializes changes against new reservations. Stale revisions return 409.

Appointment rows live in the existing private SQLite database with explicit tenant scope. Booking creates its table and indexes when active; deactivation leaves them intact. Public demos replace contacts with fictional values, limit reservations and prune records after 24 hours. Demo business settings stay locked while fictional reservations and manager cancellation remain usable.

## Host integration and verification

`public_html/plugins/booking/storefront.js` exports `mountBooking(root, {endpoint})`. `page.js` mounts roots marked `data-dyws-booking`, optionally reading `data-dyws-booking-endpoint`. It needs no inline script, third party service or browser contact storage. Its cancellation token stays in page memory. A customer must retain that confirmation page to use its cancellation button; notification delivery is not configured by this plugin.

The admin plugin offers Appointments navigation and a settings and operations panel. Booking only installations land on that panel after sign in. Generic labels use business terms, including Pay at pickup. Existing stored `pay-at-restaurant` and `pay_at_restaurant` identifiers are preserved for payment history compatibility; they are not interface labels.

Run `npm test`. Coverage includes plugin deactivation, corrupt implementation handling, core reads without plugin files, tenant isolation, token scope, configuration revisions, overlapping services, stored receipts after configuration changes and two independent PHP processes competing for one interval. Run the browser and live rollout checks separately before claiming deployed behavior.
