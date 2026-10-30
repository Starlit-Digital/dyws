# Business service platform implementation

Owner scope, October 29, 2026.

1. Separate catalog, pickup and delivery into independently managed plugins. Preserve authoritative core pricing, tenant boundaries, stored orders and existing demos. Deactivation must stop new use while historical records remain readable.
2. Add an independent appointment booking plugin with service durations, business timezone, availability, conflict protection, idempotent booking, cancellation and manager controls.
3. Add ten isolated fictional demo websites: vape retail, vape supplies, laundry, florist, print shop, auto detailing, barber, pet grooming, cleaning and repair appointments. Use ordering or appointments appropriate to each business.
4. Verify backend contracts, plugin activation and deactivation, existing storefronts, new customer actions and responsive interfaces. Deploy through existing reviewed showcase workflow and preserve runtime data.
5. Only after all functionality and ten demos are complete and verified, update public copy and documentation to position DYWS as a business service platform. Technical implementation documentation can accompany the changes; do not announce unfinished capabilities as available.

The existing ten restaurant demos remain available. These are additional demos within the existing dyws.ca source repository. Real payments, email, dispatch and fulfillment remain subject to existing public demo restrictions.

## Current progress

Active implementation, not deployed or complete.

* Catalog item and option pricing, pickup scheduling, pickup checkout controls and delivery dispatch commands now execute through their optional plugins. Core retains authentication, authoritative totals, durable transactions and historical projections. Business operation contracts and Booking API details are in `docs/business-capability-plugins.md`.
* Appointment Booking has tenant scoped reservations, shared staff or room resources, snapshot service duration and timezone, serialized overlap checks, idempotent retries, customer token cancellation and manager settings and operations. Public demos retain fictional contacts, locked settings and 24 hour retention.
* The full framework suite passed after extraction and generic admin wording changes. Booking has 22 focused checks. The combined business plugin HTTP suite has 69 checks, including a two process race producing exactly one reservation. Later validation and manager UI refinements have focused checks; rerun the final suite before release.
* Ten additional demo profiles and source catalogs exist in dyws.ca. Five pickup demos: vape shop, vape supplies, laundry, florist and print shop. Five booking demos: auto detailing, barber, pet grooming, cleaning and repair studio. The source seed authoring script is `scripts/create-business-service-seeds.py`.
* Local build: dyws.ca/runtime/business-platform. All 20 storefronts and their catalog or booking service endpoints returned HTTP 200. Browser verification confirmed a booking, appointment manager sign in and cancellation, and florist checkout through a new order receipt. All ten new storefronts fit 320px without horizontal overflow.
* New business compositions adapt Connected tools, `corelane-build-cluster-page`, through the established showcase split hero, action and service ledger. Its source and preview were inspected. Each new business has a CSS identity and sign treatment. No raster image was added. Broader theme, enlarged text, keyboard and browser error checks remain required.
* Source was not pushed and production paths have not changed. Existing unrelated showcase and concurrent framework accessibility edits are preserved.

## Remaining requirements

1. Finish browser regression, manager settings usability and absence of food specific reusable labels. Verify booking completion, cancellation and retry errors, pickup scheduling, plugin categories and inactive feature navigation. Public demo settings must remain locked while appointment operations work.
2. Create and verify a scoped source release and extracted install kit, keeping concurrent accessibility work separate unless explicitly reviewed for this rollout. Preserve all existing edits. Run the final required suite against the actual release bytes.
3. Prepare and validate a deployment manifest against the current hosted source. Back up SQLite and affected files privately. Add ten new isolated instances and update existing engines without replacing catalogs, credentials, business settings, unlisted pricing or existing records. Verify all 20 live customer actions and record receipts.
4. Only after the plugins and all ten new demos are complete and verified, update DYWS public copy and documentation to present it as a business service platform. The owner's instruction is a completion requirement. Generic admin terminology is separately authorized now.

## Verified implementation checkpoint

Pickup scheduling and its browser controller now live under the pickup plugin. Delivery dispatch commands and route handlers live under the delivery plugin. Catalog cart selection and option pricing live under the catalog plugin. Core invokes required business operations through the plugin runtime and retains authentication, final totals, durable order transactions and historical projections. LocalTime is a shared civil time primitive.

The full framework suite passed after extraction. Additional HTTP coverage now includes independent deactivation, missing and broken plugin code, historical receipt access without plugin files, booking authentication, preserved idempotent booking receipts after service removal and a two process slot race. The race creates exactly one reservation. The combined business plugin HTTP test passes 69 checks.

Booking settings use a tenant specific private JSON file, revision checks and a database write lock shared with reservations. Services share named staff or room resources by default. Appointments snapshot their resource, duration, service name and timezone. Public demo records expire after 24 hours and contacts are fictional. Settings remain locked in public demos while appointment operations work.

Browser verification confirmed booking admin login lands directly on Appointments, settings are disabled in the public demo, and the manager can cancel a fictional appointment. This exposed and fixed a demo browser lock that had also disabled operational buttons. Further responsive and end to end checks remain required.

Owner clarification, October 29: All admin interface labels must be generic business language. Food names may remain in actual restaurant demo catalog records, but reusable labels, accessible names, layout previews, payment choices and printer defaults must use business terminology. Legacy stored payment identifiers remain unchanged to preserve ledger history.

## Scoped release checkout

A separate local clone at `/tmp/dyws-business-release-20261029` contains the task changes without the concurrent accessibility work. Its local commit is `c22e10b`. The complete `npm test` suite passed against this checkout, including 22 Booking and 69 business plugin HTTP checks. `npm run build:zip` and `npm run verify:release` passed; the resulting 835 entry archive has SHA256 `ddc04ee3b840720bd3b487c33e8fb339e1646b1fd206bfce5e2d3a977ac7a78c`. An extracted kit initialized a fresh private runtime and discovered Catalog, Pickup and Delivery as active plugins. The kit does not include the test directory, so the full suite was run against the corresponding scoped checkout, not the extracted archive. The final archive was rebuilt after removing trailing whitespace; repeat the extracted smoke check on those final bytes before deployment. No source was pushed or deployed.

## Final archive and release based demo build

The final archive digest recorded above was extracted into `/tmp/dyws-final-archive-check`, initialized into a fresh private runtime and verified to load Catalog, Pickup and Delivery. A fresh isolated 20 instance showcase was then built in `dyws.ca/runtime/business-release-qa` using the clean scoped engine commit `c22e10b`. All 20 storefronts and their respective Catalog or Booking service endpoints passed 40 local HTTP checks. The test server is on port 8198. These checks do not replace customer action, accessibility or live deployment checks.

## Release based customer action checks

`dyws.ca/tests/business-release-actions.py` exercised the isolated `business-release-qa` build on port 8198. All 15 ordering storefronts created and tracked a fictional pickup order. Each of the ten existing restaurant demos also created and tracked a fictional delivery order. Each of the five booking storefronts reserved an available appointment, retried the same request without creating a duplicate, and cancelled it with its token. These are local API checks; production deployment, browser validation across the full matrix and live checks remain outstanding.

## Release based browser checks

On the release based local showcase at port 8198, the barber demo confirmed and cancelled a fictional appointment in the browser. The florist demo showed pickup as its only fulfillment mode, used the generic Pay at pickup label, loaded scheduled pickup controls and successfully reached review with a scheduled pickup time. A visible storefront review also found food specific menu labels on pickup service demos; their source template now uses Catalog and Items for these demos. Rebuild and verify those template edits before deployment.

## Deployment source stage

The corrected pickup storefront labels were rebuilt and verified for all five pickup businesses. The local customer action suite passed again across all 20 instances. `dyws.ca/scripts/prepare-business-release.py` now creates a private, hash inventoried source stage at `/tmp/dyws-business-deployment-stage` from the tested clean framework commit and the ten new demo seeds and templates. This stage is preparation only: gallery integration, host comparison, backup, rollout and live verification are not yet complete.
