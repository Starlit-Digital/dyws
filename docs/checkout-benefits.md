# Checkout benefits and durable business events

The public framework provides neutral transaction seams. Private reward rules and ledgers remain in separately installed plugins.

A selected benefit is `{checkoutBenefit: {plugin: "installed-plugin-id", id: "opaque-benefit-id"}}`. It is part of the canonical order fingerprint. Customer identity comes from the verified account session, never this body. Ordinary checkout without a selection never requires a benefit plugin.

A selected plugin must implement two required business operations:

* `checkout.quote(body, customerId, quote)` returns an integer discount in cents and a safe deal descriptor with a name. The core rejects a missing or disabled plugin, invalid amounts, missing customer identity and a simultaneous deal claim. This is a required operation, not a forgiving filter.
* `checkout.reserve(body, customerId, orderId, discount)` must recheck ownership and availability and reserve the benefit on the supplied Store database connection. It runs inside the same immediate SQLite transaction as order creation. Throw on any conflict. No payment calls or separate database commits belong here.

The core recomputes delivery fees, tax and total after the benefit. A server quote does not reserve a benefit. Commit recomputes it under the order transaction. An identical idempotency replay returns the existing receipt without reserving again. Customer browser totals and plugin data cannot set the discount.

`business_events` is a private additive journal with monotonic ID, tenant, order ID, version 1, kind, source ID, safe JSON payload and UTC creation time. SQLite triggers write it atomically with source changes, including writes by separately installed payment plugins:

* `order.placed` snapshots the original account ID, provider, merchandise subtotal and currency when the placed event is inserted. Later guest linking does not rewrite this origin.
* `order.state` records status or payment status changes.
* `payment.refund` records each committed refund delta source ID and merchandise/total amount.
* `payment.checkout` records checkout attempt status changes, including expiry and failure.

Consumers keep their own tenant cursor, unique work identities and transaction boundaries. Reading a journal entry is not authorization to mark a payment paid, charge a customer or send marketing. Workers must recheck the authoritative order/payment records. A rolled back source change produces no committed journal entry. Existing records are not backfilled.

Keep this journal and consumer ledgers in private database backups. Do not prune journal entries before every enabled consumer has durably reconciled them. No cleanup or host schedule is installed by this change.
