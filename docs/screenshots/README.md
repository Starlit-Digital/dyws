# Screenshot examples

Captured October 23, 2026 using the real PHP pages and browser modules in separate local installations. The refreshed Orders, delivery run, reporting, plugin, driver, checkout and tracking images show the development build after the public delivery run rollout, checkout pill selector and tracking and order detail styling refresh. Other images remain from the 0.10.0 release fixture. These are browser screenshots, not design mockups. JPEG originals are committed here and embedded in the root README.

The refreshed disposable fixture contains twenty four seeded orders, including two delivery runs with two stops each, plus one order placed through the pill selector checkout. Screens were captured at different stages of these example flows. The earlier fixture contained eighteen seeded orders and one checkout. Customers use names such as Morgan Example, Alex Example, Jordan Demo and Taylor Sample, the fictional phone 7805550142 and fictional addresses on Example Avenue NW, Edmonton. Earlier fixture orders were dated across two weeks to make reporting charts useful. Figures are illustrative test ledger amounts.

| File | Example |
| --- | --- |
| customer-storefront.jpg | Diner host page and hero |
| customer-menu.jpg | Breakfast category with product controls |
| customer-cart.jpg | Quantity controls, removal buttons and totals |
| customer-checkout.jpg | Pickup and Delivery pill selector and delivery address fields |
| customer-tracking.jpg | Order received, arrival card and connected progress timeline |
| customer-delivery-run.jpg | Connected progress timeline and one stop before the customer |
| customer-complete.jpg | A completed run stop, with all milestones complete |
| driver-login.jpg | Driver sign in with an empty password |
| driver-console.jpg | Active two stop delivery run and next stop action |
| admin-orders.jpg | Active orders with coloured status, fulfillment and payment badges |
| admin-order-detail.jpg | Grouped customer information, prices, status badges and actions |
| admin-delivery-runs.jpg | Ordered stops and run status, cropped to the run detail |
| admin-reports.jpg | Full dashboard with fictional reporting history |
| admin-catalog.jpg | Category and item editor |
| admin-plugins.jpg | Bundled plugin controls |

No live orders or personal customer details were used. No credentials, authentication cookies, API keys or tracking tokens are visible or stored in this folder. The example order reference alone does not grant tracking access. Maps and Stripe were left unconfigured. The test delivery used the public Manning Town Centre area as a simulated origin and did not access device GPS. No real charge, refund or delivery occurred.

To refresh these images, create a separate CLI demo fixture, use fictional customer records, capture the documented pages, review each image for secrets and readability, and replace the matching JPEG. Keep fixture configuration and databases outside Git. Do not use the hosted restaurant's records to recreate the gallery.

The October 23 gallery refresh was published to `/dyws/`, and the six changed presentation modules were published to both `/diner/` and `/diner-demo/`. Configuration, accounts, catalog, order data and demo restrictions were not deployed or replaced. Both installs passed HTTP smoke checks and asset digest checks; the public checkout retained its fictional fields and disabled device GPS policy.
