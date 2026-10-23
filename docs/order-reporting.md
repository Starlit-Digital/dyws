# Order Reporting

Version 0.7.0 adds two bundled plugins: Order Reporting and DataTables. Both use the existing Admin Reports page and manager authentication. No data is sent to a reporting service.

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

Each report uses one currency and optionally pickup or delivery. Historic currency comes from the order snapshot. Currency selection never converts or adds different currencies. Filters apply to charts, cards, tables and exports. The separate Orders page shows the latest 200 orders, independent of report filters.

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

Manager bearer authentication required. A driver receives 403 and anonymous callers receive 401. Malformed dates and filters receive 422. Valid fulfilment values are all, pickup and delivery. Disabling the plugin removes its route. Existing GET /manager/reports also receives an orderReporting aggregate via reports.summary; existing core totals keep their original definitions for compatibility.

The dataset has schemaVersion, demo, currency, currencies, fulfillment, timeZone, range, previousRange, current and previous. Current contains summary, daily, statuses, fulfillment, hours and items. Previous contains summary metrics only. Money is integer cents. Daily arrays include zero activity dates. No customer names, phone numbers, addresses, GPS, tracking tokens or driver identities appear in the dataset or exports.

## Browser integration

Order Reporting provides reports.renderer. Core owns login, date controls, requests, fallback summaries and order actions. Seven new hook contracts bring the catalog to 32, covering aggregate filters, completion observers, report controls, query parameters, summary cards, export rows and table lifecycle. See plugin-hooks.md.

CSV buttons export the complete selected dataset, not only the searched or paginated DataTables rows. Summary CSV includes units, dates, currency and fulfilment; item and daily exports include scope metadata and cent units. SVG buttons download standalone charts with titles and descriptions. Tables provide exact values without requiring hover or colour recognition.

DataTables 3.1.4 is served locally from public_html/plugins/datatables/vendor. Its core is MIT licensed and dependency free. No jQuery or premium package is used. Sources: https://cdn.datatables.net/ and https://datatables.net/manual/core/installation . License: https://datatables.net/license/mit . Keep vendor/LICENSE.txt with redistributed files.

The JavaScript source is https://cdn.datatables.net/3.1.4/js/dataTables.min.mjs, saved unchanged as dataTables.min.js for shared host MIME compatibility. CSS source is https://cdn.datatables.net/3.1.4/css/dataTables.dataTables.min.css.

Vendor SHA256:

- dataTables.min.js: 49473f1427dd1809dd5b5981e1663466bab720137a3217f69cee5f10393e1843
- dataTables.dataTables.min.css: 156624d53bf9385a37f857fbc290361d4104d3536d30930fb86bce5cc0f19387

Future plugins can mark a semantic table with data-dyws-report-table and call admin:tables with phase mount. Use phase dispose before replacing it. DataTables retains no browser storage and destroys detached instances. Its search and pagination remain stable while the dataset is unchanged. A focused table is allowed to finish interaction before refreshed data replaces it.

## Compact orders, version 0.8.0

The order board now uses the bundled DataTables plugin with ten rows per page, column sorting, search and Status, Type and Payment filters. The order number opens a single detail panel containing the existing status, assignment and test payment actions. Search and filters cover the latest 200 orders, independent of the period selected on Reports. The scope is visible beside the table. Prices and placed times sort using integer values, not their formatted strings. Each order retains its own currency.

Live changes retain search, filters, sorting and pagination in memory. No customer search terms or contacts are saved in browser storage. Focused fields are left intact until the next refresh after focus leaves. The semantic table and basic search and filters remain available when DataTables is disabled. Full order history search beyond 200 orders is not part of this board.

Settings now controls the timezone used by reports, daily and hourly grouping, order dates, driver GPS timestamps, customer tracking completion times and arrival estimates. CSV exports identify the selected timezone. UTC timestamps and elapsed durations do not change. Calendar date bounds account for both 23 hour and 25 hour daylight saving days.

DataTables integration follows the official [search API](https://datatables.net/reference/api/search()) and [column search API](https://datatables.net/reference/api/column().search()).

## Separate admin pages, version 0.8.2

Reports remains at manager.html and loads only reporting data, charts and exports. Orders is at orders-admin.html, with the same session, searchable table, filters and detail actions. Active delivery maps appear below the order table only when deliveries are on the way. The Orders page makes no reporting requests. The existing admin:order hook runs there; admin:dashboard and reporting hooks remain on Reports.
