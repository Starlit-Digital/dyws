# Screenshot examples

Captured October 23, 2026 for dyws 0.10.0 using the real PHP pages and browser modules in a separate local installation. These are browser screenshots, not design mockups. JPEG originals are committed here and embedded in the root README.

The disposable fixture contains eighteen seeded orders plus one order placed through checkout. Customers use names such as Morgan Example, Alex Example, Jordan Demo and Taylor Sample, the fictional phone 7805550142 and the fictional address 123 Example Avenue NW, Edmonton. Earlier fixture orders were dated across two weeks to make reporting charts useful. Figures are illustrative test ledger amounts.

| File | Example |
| --- | --- |
| customer-storefront.jpg | Diner host page and hero |
| customer-menu.jpg | Breakfast category with product controls |
| customer-cart.jpg | Quantity controls, removal buttons and totals |
| customer-checkout.jpg | Contact fields, totals and test acknowledgement at the end of delivery checkout |
| customer-tracking.jpg | Private order page immediately after checkout |
| customer-complete.jpg | The same order after driver completion, updated automatically |
| driver-login.jpg | Driver sign in with an empty password |
| driver-console.jpg | Assigned delivery ready for pickup |
| admin-orders.jpg | Active orders, search and filters |
| admin-reports.jpg | Full dashboard with fictional reporting history |
| admin-catalog.jpg | Category and item editor |
| admin-plugins.jpg | Bundled plugin controls |

No live orders or personal customer details were used. No credentials, authentication cookies, API keys or tracking tokens are visible or stored in this folder. The example order reference alone does not grant tracking access. Maps and Stripe were left unconfigured. The test delivery used the public Manning Town Centre area as a simulated origin and did not access device GPS. No real charge, refund or delivery occurred.

To refresh these images, create a separate CLI demo fixture, use fictional customer records, capture the documented pages, review each image for secrets and readability, and replace the matching JPEG. Keep fixture configuration and databases outside Git. Do not use the hosted restaurant's records to recreate the gallery.
