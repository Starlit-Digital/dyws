# Changelog

## 0.11.0 · 2026-10-24

- Add a compact single address checkout, cached Canadian locality names, two line review addresses and an inline countdown that toggles pause and resume.
- Include the optional order printer pilot and firmware, with physical hardware validation still pending.

- Format checkout phone numbers while typing and pasting, including partial numbers, while preserving the editing cursor and custom checkout layouts.

- Business details now supports location rows. Checkout selects an available branch, and orders preserve its name, pickup address and phone through admin, driver and tracking views. Final review pickup addresses are clickable Google Maps links. Older single address catalogs and custom order layouts remain usable.
- Driver profiles now offer six local vehicle icons with Car as the default. Choices persist per driver and update Google Maps markers in operator and customer views. The additive account migration preserves existing records, and the public demo allows this narrow cosmetic preference while retaining its account and business restrictions.
- Drivers now edit their own vehicle model and colour alongside their profile icon. The colour picker offers 32 named 16px square chits. Manager driver cards retain vehicle details for reference. Existing custom colours are preserved until the driver chooses a replacement.
- Add optional address suggestions from an owned Nominatim service, bounded prefix and typo matching, and an Alberta civic address supplement. Preserve manual entry, house numbers, private credentials and fictional public demo lookups. Include service configuration, import and matching tools, deployment records and tests.
- Document DYWS under Starlit Developer Tools and its optional role in Starlit SiteCraft website projects. Update the feature overview and payment connector limits.

- Add independent sandbox connector plugins for Square, PayPal, Helcim, Clover, Moneris and Authorize.net, with encrypted tenant credentials, revision protected settings APIs, provider connections, verification and signed event hooks. Keep customer checkout activation separate. Group plugins by type in an accessible vertical tab bar on the left.

- Add the optional Order Format plugin with named stage templates, a field palette, two column drag and drop canvas, desktop and phone previews, alignment and spanning controls, and stage assignments. Preserve built in stage formats when disabled, unassigned or invalid. Protect essential checkout controls, preserve drafts on deactivation and keep public demo saving locked.

- Add a final checkout review with Back on the left and Looks good! on the right. Count down from 10 before submission, allow immediate confirmation or more time, cancel on Back or close, and pause when the page is hidden.
- Simplify final checkout with delivery fee and tax directly beneath the items. Remove the earlier fee notice and visible address heading, keep the review free of extra headings and notice boxes, and retain screen reader status updates. Put the customer name first, format their phone number, and collect street address, optional unit and optional postal code for local delivery. Show the postal code beneath the street in the final review and reduce vertical review spacing by 25 percent.
- Enrich customer tracking with a pending confirmation notice, brief motion that respects reduced motion, a Confirmed step, saved receipt, fulfillment information and business contact link. Announce meaningful updates once through a polite live region and preserve payment controls during polling.
- Add All dates, Today, Yesterday, This week and This month to Orders. Use the business timezone, a Monday week boundary and calendar dates across daylight saving changes. Preserve the selection during refresh.

- Add optional driver vehicle type and colour, stored in SQLite without changing credentials. Private customer tracking shows the assigned driver name and vehicle, including initial PHP output and live updates.
- Remove demonstration wording from visible storefront, driver, tracking and admin labels. Keep installation restrictions, simulated location labels and payment safeguards intact.

- Brand the cart header with the site logo and business name, centre Your Order, and retain Close on the right. The reusable component accepts a site-logo slot. Centre Continue to checkout in the first stage and place Back to cart before Place order in checkout. Double and centre totals in both stages, with grouped currency formatting.

- Add Item Order Cap to Business details, defaulting to 10 per product across options. Enforce it in the cart and API, and show a call the store dialog for larger orders. Add editable business phone and email fields.

- Reserve fixed widths for cart buttons and the quantity, using tabular digits to prevent movement between one and two digit counts.

- Combine the cart decrement and remove control: the left button shows trash at one item and minus for larger quantities, with the count always in the middle. Align the controls beside the item name and price.

- Lead checkout with Name and Phone number in two columns, including on mobile. Pair delivery address fields, show the pickup location only for Pickup, and link it to Google Maps in a new tab.
- Consolidate the diner demonstration notice in the hero and remove repeated test wording from customer, driver and admin screens. Demo restrictions and payment safeguards remain unchanged.

- Extend warm surfaces, rounded actions, clear form grouping and theme aware contrast across the storefront, cart, every admin page, sign in, driver console and installer. Drivers now see a highlighted next stop and accessible run progress. Browser charts follow the page palette while exported SVGs retain their standalone colours.

- Refine customer tracking and expanded order details with warm theme aware accents, stronger typography, grouped information and rounded controls.

- Replace the checkout Order type dropdown with an accessible Pickup and Delivery pill selector, preserving address validation and fee calculation.
- Refresh the screenshot gallery with delivery runs, semantic status badges and connected customer tracking.

- Allow public demo delivery runs through precise lockdown endpoints, retain simulated GPS and critical setting restrictions, and clean up expiring run stops and bounded history.

- Add manually ordered delivery runs, atomic pickup, one active run per driver, per stop completion, shared GPS and private stops ahead tracking. Validated first on the private diner installation, then enabled on the public demo with lockdown preserved.
- Add shared semantic status badges to Orders, delivery runs, driver accounts, plugin states, provider settings, reports and customer payment status. Labels and glyphs accompany every colour.
- Connect the customer progress steps into a responsive timeline with clear completed, current and upcoming states, accessible labels and theme aware contrast.

- Move the hosted example to `/diner-demo/` with isolated fictional data and public `admin / admin` and `driver / driver` accounts.
- Bundle an optional Demo Lockdown plugin with server enforced critical setting restrictions, simulated GPS, disabled external payments and maps, bounded temporary records and fictional checkout data.
- Add mandatory installation plugins and five policy, input and presentation hooks. Required protection cannot be deactivated in Admin and fails closed when its files are missing or broken.

- Return newly created Stripe Checkout sessions to the correct private order page after payment or cancellation, using the existing order cookie and preserving webhook payment verification.

- Make the complete Git checkout the primary development and installation workflow.
- Keep the optional install ZIP and checksum in ignored `dist/`, published as release assets instead of committed binaries.
- Update installation, development and packaging instructions. Existing 0.10.0 release downloads remain available.
- Audit current documentation against the implementation: correct account storage, authentication, tracking, plugin hooks, routes, module paths and map behavior; consolidate deployment guidance and remove obsolete naming history.

## 0.10.0 · October 23, 2026

First packaged GitHub preview release of dyws. This tag includes the complete earlier development history and the recent startup, tracking and administrator refresh work.

### Customer and driver experience

- Generic categorized catalog, reusable PHP rendering, scoped CSS and JavaScript modules, cart quantities, option prices and structured delivery checkout.
- Private order status pages with progress, conditional route estimates and delivery completion confirmation.
- Driver sign in, assigned delivery details, pickup and completion controls, and scoped browser GPS during active deliveries.
- Tracking reads recover from stalled connections. Returning to a tab or window and reconnecting refresh the relevant operational pages.
- Diner reference website with photographs, a hero, display preferences and fictional business details.

### Administration and plugins

- Protected PHP administration, standalone sign in and Orders as the default landing page.
- Active orders first with DataTables search, sorting and filters; separate Reports, Catalog, Drivers, Password, Settings and Plugins pages.
- Automatic refresh across administration with form snapshots, editing guards, saved revision preservation and protection against older responses overtaking edits.
- Bundled Google Maps, Stripe sandbox, Order Reporting and DataTables plugins with private settings and 32 documented hook contracts.
- PHP Provides and Requires attributes resolve the browser features needed by each page.
- UTC storage, a configurable display timezone, reporting charts, comparisons, CSV and SVG exports.

### Packaging and documentation

- A complete README feature breakdown and twelve reviewed screenshots from a separate fictional local fixture.
- A root VERSION file aligned with the application and browser package manifests. Plugins and the optional relay retain independent component versions.
- A single installation ZIP including locked PHP dependencies, the optional relay source and lockfile, version and changelog files, and a per file hash manifest.
- SHA256SUMS and a release verification command covering archive contents, source consistency, version alignment, private file exclusions and README images.
- Separate detailed documentation, version preparation and package commits, each with an annotated tag.

### Validation

Release verification runs the complete application suite, the WebSocket relay integration suite, archive verification and the extracted ZIP browser installer tests. Browser walkthroughs cover the example checkout, admin screens, driver sign in, delivery completion and automatic customer confirmation. Screenshots contain fictional data only.

### Upgrade notes

Back up code and private storage before deployment. Preserve runtime JSON, SQLite, credentials and the host's private bootstrap adapter. Do not deploy setup over an installed merchant site. Update both private plugin implementations and their public assets, PHP modules and browser modules together. This release's final preparation changes packaging and documentation; it does not require a database migration from the 0.9.4 development checkout that preceded this release.

Use directory routes such as `/admin/`, `/orders/`, `/driver/` and `/tracking/`, and current dyws identifiers. Obsolete HTML routes, index.php links and earlier component aliases are intentionally unsupported. Existing pages should be reopened once after uploading updated scripts.

### Preview limits

This is a demonstration release, not a production delivery service. Stripe is sandbox only, the hosted diner uses HTTPS polling and a simulated origin, and Google Maps requires configuration. Native mobile applications, reliable background GPS, marketplace payouts and managed production operations are not included. The optional WebSocket relay must be deployed separately.
