# Starlit Diner reference integration

Starlit Diner is the fictional working example of dyws. Its host pages and assets live in `../../public_html/`. The example has five categories with seven items each and is hosted at `https://sltd.ca/diner-demo/`.

| Surface | Hosted URL |
| --- | --- |
| Customer storefront | `/diner-demo/` |
| Administrator entry | `/diner-demo/admin/`, sign in then Orders |
| Driver console | `/diner-demo/driver/` |
| Private customer tracking | `/diner-demo/tracking/`, entered through the link created after checkout |

Tracking exchanges the private fragment token for an order scoped HttpOnly cookie and then shows only the order reference in its URL. See [access details](../../docs/api.md).

Use fictional customer details. Manual payments are test records; optional Stripe payments use sandbox Checkout. Drivers see assigned addresses and pickup or completion actions. GPS starts automatically for an assigned active delivery, subject to browser permission. There are no sharing buttons. The hosted test configuration uses a labelled Manning area simulated origin; fresh installations do not enable that override. No real driver is dispatched.

See [installation](../../INSTALL.md) for browser setup or the separate CLI demo fixture, and [maps and GPS](../../docs/gps-maps-realtime.md) for location behavior.
