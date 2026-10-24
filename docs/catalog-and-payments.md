# Generic catalog and Stripe connector

dyws means Do You Want Something? and is the confirmed product name. `platformName` configures the product display label and `businessName` identifies the business. The fictional diner keeps its own branding.

## Catalog

The authoritative catalog is `var/catalog.json`, outside the web root. Initial examples live in `examples/starlit-diner/catalog.json` and `examples/general-store/catalog.json`. `GET /catalog` returns validated active products to the storefront. The generic `<dyws-ordering>` component consumes that endpoint.

| Field | Meaning |
| --- | --- |
| schemaVersion | 2 |
| businessName, platformName | Business identity and editable product name |
| currency | CAD or USD, fixed per deployment |
| taxBasisPoints | Configured flat example rate, 500 means 5% |
| deliveryFee | Integer cents, used by both cart and server |
| pickupAddress | Pickup text for this business |
| categories | Groups with stable id, name, optional image and items |
| items[].id | Stable unique product identifier |
| sku | Optional business SKU |
| name, description | Plain text product details |
| image | Optional object containing src and alt |
| price | Integer cents, 1295 means 12.95 |
| active | Whether customers can order the product |
| unit | Display description such as each, box or hour |
| optionLabel, variants | Optional named choices with stable IDs and integer prices |
| metadata | Optional public named scalar attributes, never private data |

All quantities are whole units. Availability is a switch, not stock reservation. Images are URLs or relative paths, not uploaded binaries. Supported currencies use two decimal places. Real inventory, shipping calculations, digital fulfillment and jurisdiction based tax rules are separate work.

Admin opens `catalog/`, edits categories and items and saves. The API validates before replacing the private file atomically. Revision checks prevent a stale editor from overwriting another save. Order lines snapshot names, descriptions, SKUs, images, options and prices; later edits do not rewrite old orders. A new order always uses the private server prices and delivery fee.

## Payment setup

1. Create a separate Stripe sandbox for testing. Use a restricted sandbox API key with Checkout Sessions read and write access and the linked permissions required for creating Checkout Products, Prices and PaymentIntents. The connection check checks session read access only; complete a sandbox checkout to verify the complete permission set.
2. Register the webhook URL shown in settings. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired` and `charge.refunded`.
3. Save the sandbox key and webhook signing secret in the authenticated admin settings. Blank inputs retain the existing secrets. Enable Stripe test checkout when the endpoint is registered.
4. Place a new test order and use its Stripe payment button on the private tracking page. The current Stripe success and cancel URLs return to the storefront with `#customer-tracking`. The storefront no longer mounts inline tracking, so this return does not reopen the dedicated order page automatically. Reopen the original private order link to see the verified payment status. Updating the Stripe return destination is still needed. A return URL is not evidence of payment.

Hosted Checkout uses the official Stripe PHP SDK, pinned by `composer.lock`, with the SDK default API version. Checkout handles card data. No publishable key or card input is needed on this site. Dynamic payment methods remain enabled. Adaptive pricing is disabled to preserve the server order currency. The example tax is sent as a separate configured amount; this is not Stripe Tax or a tax compliance engine.

The connector is a merchant owned account integration. It does not create Stripe Connect accounts, split funds, pay drivers or retain a platform commission. Those commercial choices remain future work.

## Boundaries and reconciliation

This demo accepts sandbox keys only. No live payments are enabled. The existing manual test ledger remains available for orders created with Stripe disabled. Each order records its provider and currency permanently. Manual capture and refund buttons cannot alter a Stripe order.

A tracking token is required to create or resume checkout. The server reserves one attempt per order, uses a stable Stripe idempotency key and reuses the session URL. It does not recreate an ambiguous attempt past the Stripe idempotency window. Expired or failed sessions require reviewing the existing order before placing a replacement.

Signed webhooks validate timestamp, test mode, tenant, order, attempt nonce, session, amount and currency. Duplicate event IDs and multiple paid events cannot double count collections. Async payment confirmation is supported. Unpaid Stripe orders cannot progress into fulfillment, and open payment attempts prevent cancellation until Stripe reports a terminal payment outcome. A late paid event on an already cancelled order requires manager review.

Refunds are initiated in the merchant's Stripe dashboard. `charge.refunded` reconciles cumulative partial or full refunds without double counting or reversing a later refund. Individual refund deltas retain their local reconciliation dates. Partial refunds allocate product sales, fees and tax proportionally; cumulative rounding ensures a full refund zeros every component. These are operational demo metrics, not tax or accounting statements.

Keys are never returned through an API, placed in browser storage or committed. Shared hosting stores them in `var/stripe.json`, encrypted with AES GCM and a tenant derived key from the existing private server secret. A production host should use a managed secrets vault. Back up the private configuration and encrypted file together. Changing the master secret requires reencrypting Stripe settings. Settle outstanding sandbox attempts before switching Stripe accounts or webhook secrets.

## Verification

Automated tests use the official SDK signature verifier and a fake session transport, not real Stripe credentials. They cover private catalog authorization, revisions, nonfood products, inactive items, prices, secret redaction and encryption, session reuse, webhook signatures, replay, amount and tenant mismatch, async payments, refunds and report reconciliation. An actual sandbox charge still requires the owner's Stripe credentials and registered webhook. No unrelated account credentials are needed for the automated suite.

References: [Checkout Sessions](https://docs.stripe.com/api/checkout/sessions/create), [payment fulfillment](https://docs.stripe.com/checkout/fulfillment), [webhook verification](https://docs.stripe.com/events/manage-webhook-endpoints), [API keys](https://docs.stripe.com/keys).

Use Admin → Plugins → Stripe → Settings for payment configuration. Stripe is bundled and active by default but does not enable checkout until configured. Its settings, Checkout and webhook implementation are owned by the plugin. The plugin form is available at settings/#plugin-stripe. See [plugin documentation](plugins.md) for deactivation, preserved encrypted credentials and pending payment callbacks.
