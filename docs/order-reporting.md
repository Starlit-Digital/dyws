# Order Reporting

dyws bundles Order Reporting and DataTables. Order Reporting provides the Admin Reports dashboard; DataTables supports tables in Reports and Orders. Both require manager authentication. The current application release is recorded in [VERSION](../VERSION). No data is sent to a reporting service.

## PayCal inspiration

Reviewed the local private checkout of PayCal Technologies paycal-private at commit fda5d5ee, without changing it:

- html/src/Domain/BusinessReportChartFactory.php separates aggregate data from chart descriptions, units, summaries and previous period comparisons.
- html/src/Domain/BusinessReportFilters.php defines calendar periods and matching previous ranges.
- html/src/Domain/BusinessReportExportService.php exports the same scoped data and protects spreadsheet values.
- html/src/Domain/BusinessReportCacheService.php includes business, permissions, filters and chart version in cache identities.
- html/js/earnings/trend-chart.js provides SVG summaries, accessible descriptions and compact layouts.

The dyws implementation is purpose built for its order ledger. It uses four leading metrics, progressively disclosed tables, semantic SVG descriptions, a stable render signature to avoid resetting tables on unchanged polling responses, and a consistent SQLite read snapshot. It does not import PayCal source, infrastructure or business data. There is no persistent reporting cache to invalidate or leak between managers. Future caches must include tenant, authorization, currency, fulfilment, range and dataset version, and invalidate for payments, refunds and order changes.

## Definitions

Dates use the timezone selected in Settings, America/Edmonton by default, including daylight saving changes. Both input dates are inclusive; database bounds use an exclusive midnight after the end date. Maximum range is 366 calendar days. Default is the last 30 days including today. Today may be incomplete. Previous period means the same number of calendar days immediately before the selected range. It is not a forecast or a comparison of equal elapsed working hours.

Each report uses one currency and optionally pickup or delivery. Historic currency comes from the order snapshot. Currency selection never converts or adds different currencies. Filters apply to charts, cards, tables and exports. The separate Orders page shows the first 200 orders, active before finished, independent of report filters.

| Measure | Definition |
|---|---|
| Orders | All orders created in the range, including cancelled orders. |
| Ordered value | Total including tax and delivery fees, excluding currently cancelled orders. Not payment revenue. |
| Average order | Ordered value divided by the number of noncancelled orders. |
| Active | Created in the range and not currently completed, delivered or cancelled. |
| Completed | Currently completed or delivered, divided by all orders in the creation cohort. |
| Cancelled | Currently cancelled, divided by all orders in the creation cohort. |
| Awaiting payment | Noncancelled orders in the creation cohort whose current payment status is unpaid. The value is their full order total. |
| Test payments | Capture ledger amounts dated in the range, including orders placed outside it. |
| Test refunds | Refund deltas dated in the range. The cumulative legacy refund row is excluded when deltas exist, preventing double counting. |
| Net test payments | Captures minus refunds. Negative totals are valid. |
| Net product payments, delivery fees, tax | Capture and refund components allocated in cents; tax takes the rounding remainder so components reconcile exactly to net payments. |
| Popular items | Snapshot quantity and unit price from noncancelled orders created in the range. Not paid units, margins or refunds by item. |
| Preparation | First accepted event to first ready event for orders created in the range. |
| Delivery | First out_for_delivery event to first delivered event for orders created in the range. |
| Order times | Orders by local creation hour, including cancellations. |

Durations require both events in chronological order. Missing pairs are omitted and sample counts are shown. Previous and current status metrics use today's stored status, not a reconstruction of historical status. Products are grouped by item and variant ID; the latest encountered snapshot supplies the display name. These are demonstration ledger records, not real charges, accounting statements, profit or tax advice.

## API and privacy

`GET /manager/plugins/order-reporting/dashboard?from=2026-10-01&to=2026-10-23&currency=CAD&fulfillment=all`

Manager bearer authentication required. A driver receives 403 and anonymous callers receive 401. Malformed dates and filters receive 422. Valid fulfilment values are all, pickup and delivery. Disabling the plugin removes its route. Existing GET /manager/reports also receives an orderReporting aggregate via reports.summary. The plugin ordered value and average exclude cancelled orders; the core fallback ordered value and average include them. Core popular item totals exclude cancellations. Keep these definitions separate when building another renderer.

The dataset has schemaVersion, demo, currency, currencies, fulfillment, timeZone, range, previousRange, current and previous. Current contains summary, daily, statuses, fulfillment, hours and items. Previous contains summary metrics only. Money is integer cents. Daily arrays include zero activity dates. No customer names, phone numbers, addresses, GPS, tracking tokens or driver identities appear in the dataset or exports.

## Browser integration

Order Reporting provides reports.renderer. The PHP host owns sign in; core owns date controls, requests and fallback summaries. Order actions live on Orders. Seven reporting and table contracts are part of the 37 hook catalog, covering aggregate filters, completion observers, report controls, query parameters, summary cards, export rows and table lifecycle. See plugin-hooks.md.

CSV buttons export the complete selected dataset, not only the searched or paginated DataTables rows. Summary CSV includes units, dates, currency and fulfilment; item and daily exports include scope metadata and cent units. SVG buttons download standalone charts with titles and descriptions. Tables provide exact values without requiring hover or colour recognition.

DataTables 3.1.4 is served locally from public_html/plugins/datatables/vendor. Its core is MIT licensed and dependency free. No jQuery or premium package is used. Sources: https://cdn.datatables.net/ and https://datatables.net/manual/core/installation . License: https://datatables.net/license/mit . Keep vendor/LICENSE.txt with redistributed files.

The JavaScript source is https://cdn.datatables.net/3.1.4/js/dataTables.min.mjs, saved unchanged as dataTables.min.js for shared host MIME compatibility. CSS source is https://cdn.datatables.net/3.1.4/css/dataTables.dataTables.min.css.

Vendor SHA256:

- dataTables.min.js: 49473f1427dd1809dd5b5981e1663466bab720137a3217f69cee5f10393e1843
- dataTables.dataTables.min.css: 156624d53bf9385a37f857fbc290361d4104d3536d30930fb86bce5cc0f19387

Future plugins can mark a semantic table with data-dyws-report-table and call admin:tables with phase mount. Use phase dispose before replacing it. DataTables retains no browser storage and destroys detached instances. Its search and pagination remain stable while the dataset is unchanged. A focused table is allowed to finish interaction before refreshed data replaces it.

## Compact orders

The order board now uses the bundled DataTables plugin with ten rows per page, column sorting, search and Status, Type and Payment filters. The order number opens a single detail panel containing the existing status, assignment and test payment actions. Search and filters cover the first 200 orders, active before finished, independent of the period selected on Reports. The scope is visible beside the table. Prices and placed times sort using integer values, not their formatted strings. Each order retains its own currency.

Live changes retain search, filters, sorting and pagination in memory. No customer search terms or contacts are saved in browser storage. Focused fields are left intact until the next refresh after focus leaves. The semantic table and basic search and filters remain available when DataTables is disabled. Full order history search beyond 200 orders is not part of this board.

Settings now controls the timezone used by reports, daily and hourly grouping, order dates, driver GPS timestamps, customer tracking completion times and arrival estimates. CSV exports identify the selected timezone. UTC timestamps and elapsed durations do not change. Calendar date bounds account for both 23 hour and 25 hour daylight saving days.

DataTables integration follows the official [search API](https://datatables.net/reference/api/search()) and [column search API](https://datatables.net/reference/api/column().search()).

## Separate admin pages

Reports remains at reports/ and loads only reporting data, charts and exports. Orders is at orders/, with the same session, searchable table, filters and detail actions. Active delivery maps appear below the order table only when deliveries are on the way. The Orders page makes no reporting requests. The existing admin:order hook runs there; admin:dashboard and reporting hooks remain on Reports.

Orders defaults to Active. Completed includes delivered and collected orders; Cancelled and All remain available. Active orders sort before completed and cancelled orders even when viewing All. The database applies this priority before its 200 order cap, so old pending orders are not pushed out by newer finished history. Within each group, newest orders appear first unless the operator selects another column sort.

## Owner insights and exports, October 26, 2026

The dashboard now adds estimated unique, new, returning and repeat customers, repeat customer percentage, items per order, ordered value per customer, cancelled order value, average delivery fee and refund percentage. Customer identity uses normalized phone numbers in private server memory. Numbers never appear in the dataset. Shared numbers can represent several people. Customers with no earlier retained order are new. Returning customers had an earlier order in the same currency and fulfillment scope. Repeat customers include returning customers and people with multiple orders in the selected period. Cancelled orders do not contribute to customer or basket measures.

Cancelled value includes tax and delivery fees from cancelled order snapshots. Average delivery fee excludes pickup and cancelled orders. Refund percentage divides refunds by captures on their ledger dates and may exceed 100% because refunds can relate to older orders. A zero denominator gives no data.

Acceptance time measures placed to accepted. Preparation remains accepted to ready, and delivery remains out for delivery to delivered. Each stage now includes the median and nearest rank 90th percentile, alongside its mean and sample count. Missing or reversed event pairs are excluded. These are measured durations, not an on time promise metric.

Visuals include daily order and payment charts, a weekday and hour heatmap, product quantity bars and location comparisons. Location performance uses the saved branch ID and the latest name seen in the selected cohort. Historic orders without a branch snapshot are grouped as Business. Values exclude cancelled orders while count charts include them. Daily totals, hour counts and location values reconcile to the summary.

Reports contain only aggregate data. PDF, CSV and text downloads can include a chosen subset of overview, daily, product, location and operation sections. PDF includes vector charts, the demand heatmap, repeated table headings and page numbers. PDF amounts use currency units and elapsed times use minutes. CSV retains integer cents and seconds, explicit units and spreadsheet formula protection. Text contains readable labels and explicit units. Existing individual CSV and SVG downloads remain available. The current browser filters also apply to downloads and email attachments.

The public framework includes Dompdf through the locked Composer dependencies. PDF rendering disables remote resources, embedded PHP and JavaScript. The official [Dompdf project documentation](https://github.com/dompdf/dompdf/blob/master/README.md) describes the renderer and resource restrictions. The renderer consumes escaped server generated aggregate data, never supplied HTML.

Email me uses the saved business email. It requires a host mail transport and sender configuration described in [deployment notes](deployment.md). No messages are sent automatically, and no recurring schedule is created. The feature reports transport acceptance rather than claiming delivery. Profit margins, website conversion, advertising attribution and promised delivery performance remain unavailable because their required source data is not recorded.


## Separate tip accounting

Checkout tips are voluntary whole dollar amounts stored as integer cents.
Orders, customer receipts, driver delivery cards and printed receipts display
Tip separately. The reporting dashboard and PDF, CSV and text exports include
Tips added, Tips collected, Tips refunded and Net tips in summary and daily data.
The existing ordered value and payment totals include tips. Product sales,
delivery fees and configured tax exclude tips.

`orderedTips` follows order creation dates. The Order Reporting plugin excludes
cancelled orders; the core fallback follows its existing ordered value definition
and includes them. `capturedTips` and `refundedTips` follow ledger event dates.
`netTips = capturedTips - refundedTips`. Negative net tips are valid when the
selected period contains refunds of earlier payments. Net product payments,
net tax, net delivery fees and net tips sum exactly to net payments.

Refund delta snapshots store a separate tip component. They replace cumulative
refund rows in reports to avoid double counting. Tipped partial refunds are
allocated proportionally using cumulative integer cent components, with rounding
carried between successive events. A full refund reverses every original cent.
Untipped historical orders retain the previous allocation method.

Driver profiles and manager driver cards show earned tips by delivery completion
date in the business timezone. Today, Monday through today, month to date, year
to date and all time are available. Currency groups remain separate. A later
refund reduces the original delivery day's retained earnings. This differs from
the business payment report, which records the refund on its event date. Driver
profiles also show historical daily, weekly and monthly data and recent tipped
deliveries. Pickup tips remain business order tips without driver attribution.
These are earnings and refund records; no driver payout is created.

## Reporting workspace and PDF archive, November 7, 2026

The report header shows the active dates, currency and fulfillment scope. Period presets include rolling three months, six months and one year, with clamped calendar boundaries. Custom date fields appear only when selected. Filters and Export use disclosure controls. Export offers Download PDF, Save to archive, Open archive, CSV and custom sections. Downloaded PDFs are also archived. Save to archive creates the same overview without a browser download.

Demand uses continuous OKLCH lightness for nonzero counts and dark grey for zero. Exact counts remain visible. Daily totals and hourly cells normalize independently. Hour columns are the union of current configured working hours; closed weekday cells remain marked. Daily totals include orders outside those hours. Partial hours and overnight carry are supported. This view includes cancellations. The top ten item pie uses quantity and a denominator limited to those ten items; the complete item table remains available. Trend hit regions expose dates and values by pointer and keyboard, with matching mark highlighting.

The footer records definitions, rationale, privacy and limits. Orders, payments and refunds use different event dates. Item quantities are not paid sales, customer counts are estimates, and operational reports are not audited accounts or profit forecasts. Demonstration disclaimers are conditional on host demo_lockdown configuration.

### Manager API

All routes require manager bearer authorization and the existing Reports entitlement:

* POST `/manager/plugins/order-reporting/export`, with `format: "pdf"`, optional `target`, and `query` containing `from`, `to`, `currency`, `fulfillment`. Without target, existing custom `sections` remain supported. Valid targets: overview, payment-trend, orders-by-day, demand, top-items, order-flow, locations, fulfillment, at-a-glance, all-items, daily, payments, hours.
* GET `/manager/plugins/order-reporting/archive`, optionally combining `q`, `target`, exact report `from` and `to`, `currency`, `fulfillment`, and `offset`. Returns up to 25 items and total/offset/limit. Text matching treats SQL wildcard characters literally. Items include the reference, generation time, report scope, immutable generation settings, SHA256 and byte count. These are manager-only business aggregates.
* POST `/manager/plugins/order-reporting/archive/download`, with `{ "id": "<archive id>" }`, returns the original PDF after verifying its SHA256. Missing or cross-tenant IDs return 404. A damaged file returns 503. A repeat download does not regenerate or archive another copy.

Export responses retain base64 content, MIME type and filename, and add `identity` with `reference` and ISO UTC `generatedAt`, plus `archiveId` for PDFs. Invalid targets or non-PDF target requests return 422. Archive failures fail the export with 503 so no successful PDF export silently lacks its saved original. Existing export/email rate limits remain in effect. CSV and text are not archived.

Every report PDF has the configured business name, address, phone and email when present. A host may set `reporting.businessWebsite` in private config.json to include its website. The centered footer on every page has a UTC timestamp, random 16 character uppercase alphanumeric reference and page numbering. No merchant contact data or credentials are hardcoded. The browser receives its manager token through the existing admin:report-controls hook's `getToken` callback, rather than assuming a browser storage key.

Archive bytes live outside public_html in `report-archive/<tenant hash>/`, beside the configured SQLite database. Folders use 0700 and files 0600. The tenant-scoped `report_pdf_archive` SQLite table records generation scope, business information, working hours, renderer version and digest. Back up the database and this folder together. Archive retention is indefinite; include storage capacity and retention in the host's operations policy. Existing downloads made before the feature are not recovered retroactively.

The full viewport archive dialog has a grouped year/month rail, search and combined filters, Fit width by default, page and zoom controls, PDF download and a native tab option. A locally bundled, licensed PDF.js renderer uses a same origin worker, with eval and WebAssembly disabled. Its page text is separately readable. Closing destroys the document and revokes URLs; stale selections cannot replace the current PDF. Hosts must serve .mjs as JavaScript and allow same origin workers. The bundled .htaccess does this without relaxing frame or object policies. See `public_html/plugins/order-reporting/vendor/pdfjs/README.md` for the dependency and licenses.

The copied client preview's fixture orders, restaurant content, demo management exceptions and fixture retention flags are not part of this framework backport.
