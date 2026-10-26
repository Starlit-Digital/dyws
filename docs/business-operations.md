# Business hours, delivery pricing and order intake

Business details now includes independent location and ordering schedules. Each schedule has seven days, Monday first, with Closed, Set hours and 24 hours choices. Location hours describe when the premises are open. Only ordering hours restrict new pickup and delivery orders. They may extend beyond location hours.

All schedules use the saved business timezone under General. Opening is inclusive and closing is exclusive. A closing time earlier than opening continues into the following day, even if that following day is marked closed. Equal opening and closing times are rejected; use 24 hours instead. Daylight saving changes follow local civil time, including both occurrences of a repeated hour. There is one opening period per day.

Existing installations have unrestricted ordering until a schedule is enabled. A location can inherit the business schedule or explicitly replace it with its own weekly hours or unrestricted ordering. Storefront and checkout display the published schedules. Checkout refreshes its catalog before collecting customer details, and the server checks availability when creating an order.

## Delivery pricing

The delivery charge is the flat fee plus a percentage of the item subtotal before tax, rounded once to the nearest cent, with half cents rounded up. Pickup has no delivery charge. Existing tax behavior applies to the subtotal plus delivery charge.

For example, an item subtotal of $40 with a $3 flat fee and 5% delivery percentage costs $5 for delivery. Set either component to zero to use only the other; both zero means free delivery. Every location inherits the business pricing unless the owner enables a location override.

Saved orders keep their original delivery fee and total. Client supplied prices and fees are ignored. No financial record migration is needed.

## Pause ordering

The Orders page has an Accept online orders switch. Off pauses all new orders across all locations. On permits orders subject to ordering hours and location availability. Existing orders remain manageable. A retry of an already saved order still returns its original receipt even after a pause or closing time.

The switch uses the settings revision to reject stale updates. It is restricted to managers. The public demo retains its owner imposed settings lock, so visitors cannot pause the shared storefront.

## Further owner controls worth adding

* Holiday hours and one date closures.
* A preparation buffer before the end of the ordering window.
* Minimum delivery order values and free delivery thresholds.
* Delivery areas and optional distance pricing.
* Separate pickup and delivery schedules, or multiple opening periods in one day.

These additional controls are suggestions and are not implemented in this change.
