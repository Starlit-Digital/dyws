# Deals and customer payment choices

## Optional payment at delivery or pickup

Admin Settings, Business details, Customer payment has independent switches:

* Allow pay at the door, stored as `allowPayAtDoor` in the private catalogue.
* Allow pay at restaurant for pickup, stored as `allowPayAtPickup`.

Both default to false. Delivery shows Pay now and Pay at the door only when its
switch is enabled. Pickup shows Pay now and Pay at restaurant only when its own
switch is enabled. Pay now keeps the configured online provider path. Payment
services remain separate plugins; no payment plugin is installed or enabled by
these settings. Public demos still simulate every payment and purchase.

Order requests may include `paymentMethod`: `pay_now`, `pay_at_door`, or
`pay_at_restaurant`. Missing values retain the existing Pay now path. Core checks
the restaurant setting and fulfillment type. It uses reserved providers
`pay-at-door` and `pay-at-restaurant` for deferred collection and never creates
an online checkout attempt for them. Plugins cannot register those provider names.
The choice is part of the order fingerprint; retrying an order cannot change its
payment method. Existing provider callbacks and payment records are unchanged.

Deferred orders remain unpaid during preparation. An assigned driver can record
door collection only during that delivery, through
`POST /driver/orders/{id}/payment` with `kind: capture`. Staff record restaurant
collection through the existing manager payment route. Payment must be recorded
before either delivery or pickup is completed. Operators see the collection mode
and amount due, and kitchen tickets identify deferred payment. These are ledger
records of collection, not instructions to charge a card.

Unpaid deferred orders can be cancelled without a provider call. If an in person
payment has already been recorded, cancellation flags the refund for staff.
Recording the completed manual refund updates that state. The software cannot
physically return cash or reverse a separate terminal transaction.

## Restaurant deal settings

Admin Settings has a separate Deals editor. Each deal has a stable ID, title,
description, enabled state, eligible item IDs, available weekdays, start date,
expiration date and claim lifetime. Weekdays are Monday `0` through Sunday `6`.
Dates use `YYYY-MM-DD`. Eligibility is checked on the day the order is placed in
the restaurant timezone, including when pickup is scheduled for another date.
The expiration date includes that entire local day. A claim expires at the earlier
of the offer expiration or its configured claim lifetime.

Supported `type` values:

| Type | Rules |
| --- | --- |
| `quantity` | Pay for `buyQuantity`, receive `getQuantity` extra items. One plus one is 2 for 1; one plus two is 3 for 1. |
| `buy_amount_off` | Buy the configured quantity, then receive `amountOff` cents off each extra eligible unit. |
| `spend_amount_off` | Save a fixed cent amount after reaching `minSpend`. |
| `spend_percent` | Save `percentBasisPoints` after reaching `minSpend`, which may be zero. |

Quantity offers require selected items. Spend offers can target selected items
or the whole menu. The threshold uses qualifying item value before discount,
tax, delivery and tip. Complete unit prices include size and choice surcharges.
Quantity offers discount the lowest priced qualifying units, with a configurable
maximum number of groups. Fixed discounts never exceed the affected item value.
Percentage arithmetic and allocation use integer cents and reconcile exactly.

`GET /manager/deals` returns definitions, menu choices and a catalogue revision.
`POST /manager/deals` accepts `deals` and `revision`; it changes only the deal
collection and rejects stale saves. Manager authorization is required. There are
at most 100 deals and 100 target items per deal. The public `GET /deals` endpoint
and catalogue expose enabled, unexpired offers, their schedules and whether they
apply today. Deals for unavailable items are omitted.

## Customer wallet and redemption

My Account has Account, Orders and Deals sections, including `/account/deals/`.
Deal cards also appear before menu categories. Current item offers display a badge
such as 2 for 1 or 3 for 1 on the corresponding menu item.

Customer routes use the existing same origin customer guard and verified account:

* `GET /customer/deals` lists available offers, saved claims and the selected claim.
* `POST /customer/deals/claim`, with `dealId`, saves and selects a claim.
* `POST /customer/deals/activate`, with `claimId`, selects the next order's claim;
  an empty ID deselects it.
* `POST /customer/deals/quote` prices `lines`, `dealClaimId`, fulfillment,
  location and tip, using the same calculation as order creation.

Customers can keep several claims, but one applies per order. A newly claimed
eligible deal is selected automatically at checkout. Scheduled claims can be
saved before their weekday and selected when eligible. The customer can choose
No deal, or select another claim. Signed out customers must sign in to save a
merchant claim. Account claims work across verified account sessions and devices.

`dealClaimId` is the only discount selector accepted on an order. Owner identity,
prices, rules and amounts come from the server. A claim snapshots its terms,
expires, and can be used on one placed order. Current restaurant withdrawal,
expiration and schedule restrictions still apply. Editing an offer does not
silently increase the discount on an existing claim. A removed or disabled offer
cannot be redeemed. Create a new stable ID when issuing a new offer cycle.

Validation, order insertion and redemption share one SQLite transaction. Failed
order creation does not burn a claim, parallel requests cannot spend it twice,
and a retry with the same request key returns the original order. Cancellation
does not automatically restore a claim. No client supplied price or savings value
can change the charge. The claim owner, claim ID and payment choice are included
in the relevant order fingerprint.

## Amounts, receipts and payment plugins

Orders add `discount` and `deal_json` snapshot columns; claims live in
`deal_claims`, scoped by tenant and owner. Existing rows receive zero discount and
an empty snapshot. Original line unit prices remain intact; discounted lines
carry an allocated `discount` amount. `subtotal` is the item subtotal after the
deal. Tax and percentage delivery pricing use that net subtotal. Tip is unchanged.
A zero total needs no payment and is marked paid without a zero amount ledger row.

Review, operator views, account receipts, tracking and kitchen tickets show the
saved offer and savings. Item reporting subtracts allocated savings so item net
subtotals reconcile with the discounted order. Refund allocations use the saved
net subtotal, tax, delivery and tip components.

The separate private Stripe plugin emits discounted line totals, omits fully
discounted lines and verifies that all Checkout lines equal the immutable order
total. Its SDK and implementation remain excluded from the public framework and
demos. Other connector foundations already use the saved net subtotal. Deploy
compatible plugin code wherever those payment contracts are installed.

## Public demonstrations

The ten active demos show sample offers and both deferred payment settings.
Merchant settings remain locked to visitors. Real email registration, real
payments and device GPS remain disabled.

Demo deal claims are an explicit, isolated simulation. A random HttpOnly cookie
selects a fictional wallet for that business and browser, valid for up to 24 hours.
It never creates an email account or stores contact data in browser storage.
Demo claims also expire within 24 hours and are pruned. Other customer account
mutations remain locked. Production merchant claims require verified accounts.

## Verification and migration

Run `npm test` and the private Stripe integration suite. Coverage includes all
discount types, weekday and timezone boundaries, dates, thresholds, exact cent
allocation, hidden items, ownership, tenant isolation, expiry, retries, atomic
rollback, manual payment settings, assigned driver collection and pickup payment.
Serve only `public_html`; keep all JSON, claims, databases and backups private.

The migration adds only the two order columns, claims table and indexes. Back up
SQLite through its backup API and compare every existing column and row before
and after the migration. Keep runtime settings and apply only explicit demo
catalogue fields. Once new orders use deals or deferred payment, retain compatible
code when recovering. Restoring an old database would discard newer orders and
claims and is not an acceptable code rollback.
