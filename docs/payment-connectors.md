# Payment connector plugins

Square, PayPal, Helcim, Clover, Moneris and Authorize.net are separate optional plugins. All start inactive. The Plugins page groups installed plugins by type in a vertical tab bar on the left. Each connector appears under Payments. A separately installed Stripe plugin can appear in the same category; Stripe is not included in the kit.

## Scope

This release supplies the integration foundation: encrypted credential fields, settings APIs, sandbox connection checks, provider API connectors and verified event hooks. Activating or configuring a connector does not select it for customer checkout, capture an order payment or change the payment ledger. The public framework does not include Stripe. Its separately maintained plugin supplies sandbox Checkout only when installed and configured. Each new settings API explicitly returns `stage: connector` and `checkoutEnabled: false`.

The next integration stage can use these connectors to create checkout sessions, display the provider checkout, associate its identifiers with an order and reconcile authoritative payment status. That stage must verify merchant, tenant, attempt, amount, currency, payment state and idempotency before changing the order ledger. A browser return or a generic verified event is insufficient. POS inventory and restaurant dispatch synchronization are separate features.

## Configuration

Open Edit beneath the plugin’s activation control. Activate the plugin if needed, then edit its individual settings. Save the provider's sandbox credentials and select Check connection. Blank fields preserve saved values. Explicit Clear saved checkboxes remove them. Saving requires the current revision, clears the connection check timestamp and never echoes credential values. Environment is sandbox only. Public demo configuration remains locked by Installation Lockdown.

| Plugin | Credential fields | Connection check |
| --- | --- | --- |
| Square | Access token, location ID, webhook signature key | List locations and match the configured active location |
| PayPal | Client ID, client secret, webhook ID | Obtain a sandbox OAuth token |
| Helcim | API token, webhook verifier token | Read card terminals |
| Clover | Private access token, merchant ID, Hosted Checkout signing secret | Read the configured sandbox merchant |
| Moneris | Store ID, API token, checkout configuration ID | Create a temporary $1.00 test preload ticket, without submitting a card or charging |
| Authorize.net | API login ID, transaction key, webhook signature key | authenticateTestRequest against the sandbox API |

Helcim uses the same API hostname for live and developer test accounts. Use credentials from a developer test account. A connection check confirms only the access described above, not all operation permissions or webhook delivery. No provider credentials are included in Git or shipped with the application.

Credential files are tenant scoped `payment-<plugin>-<tenant hash>.json` beside SQLite, outside public_html. AES 256 GCM keys are derived separately for the tenant and provider from the private tracking secret. Files have mode 0600. Deactivation preserves settings. Back them up with the existing private configuration and keep the tracking secret stable.

## APIs

Each active connector registers:

* `GET /manager/plugins/<id>/settings`, manager only. Returns field definitions, saved value flags, environment, configured state, verification time, documentation, operations, webhook URL and revision. It never returns credentials.
* `POST /manager/plugins/<id>/settings`, manager only. Body `{environment: "sandbox", credentials: {field: value}, clear: [field], revision}`. Unknown fields and live mode are rejected. Concurrent changes return 409.
* `POST /manager/plugins/<id>/verify`, manager only. Empty JSON body. Executes the connection check and returns safe detail. Reads time out and provider responses and credentials are not exposed in errors.

The APIs disappear on deactivation. Only host approved verified webhook routes remain. Raw connector operations are deliberately not exposed as a browser API.

## Server extension hooks

`Plugins::paymentConnector(id)` resolves an active connector through the `payments.connector` filter. A trusted PHP extension can call `request(operation, arguments)`. Supported operations are listed in the plugin's private `connector.json` and safe settings projection. Operation names map to fixed HTTPS hosts and paths; callers cannot supply a URL. The transport does not follow redirects or automatically retry mutations. Keep idempotency and retry policy in the authoritative checkout integration.

`checkout.create` accepts `{payload: providerRequest}`. PayPal additionally requires `idempotencyKey`. Square requires its documented `idempotency_key` inside the payload. Retrieval operations accept `{id: providerId}`. Moneris injects its own store credentials and QA environment even if a payload attempts to override them. Authorize.net injects merchant authentication. PayPal `order.capture` is available only to trusted PHP callers and requires `idempotencyKey`; it is not called by connection checking or any browser endpoint.

The `payments.connector_verified` action receives `(providerId, safeResult)` after a successful connection check. The `payments.connector_event` action receives `(providerId, verifiedEvent)` after signature verification and duplicate suppression of the same body. These are observation hooks. They must not charge or authorize ledger changes on their own. Observers are not a durable work queue. For reliable reconciliation, the complete checkout integration must own durable processing and provider retrieval.

| Provider | Event verification |
| --- | --- |
| Square | HMAC SHA256 over the exact notification URL and raw body |
| PayPal | PayPal sandbox verify webhook signature API, with stored webhook ID |
| Helcim | HMAC SHA256 over webhook ID, timestamp and body, using the decoded verifier token; five minute timestamp tolerance |
| Clover | HMAC SHA256 over timestamp and body; merchant match and five minute timestamp tolerance |
| Authorize.net | HMAC SHA512 over the raw body with the decoded 128 character signature key |
| Moneris | No webhook route; retrieve the receipt from Moneris using the server stored checkout ticket |

Helcim requires a delivery URL without its name, so its host approved callback is `/payments/hc/events`. Other signed callbacks use `/plugins/<id>/webhook`. All require signatures, including after deactivation. Signed events are acknowledged without marking any order paid. Duplicate hashes are namespaced by provider and tenant in the existing payment event table. No event bodies or card details are stored there.

## Official integration references

* [Square Checkout API](https://developer.squareup.com/docs/checkout-api) and [signature verification](https://developer.squareup.com/docs/webhooks/step3validate).
* [PayPal Checkout](https://developer.paypal.com/checkout/integrate) and [webhooks](https://developer.paypal.com/api/rest/webhooks/rest/).
* [HelcimPay.js](https://devdocs.helcim.com/docs/initialize-helcimpayjs) and [webhooks](https://devdocs.helcim.com/docs/webhooks).
* [Clover Hosted Checkout](https://docs.clover.com/dev/docs/hosted-checkout-api) and [webhook signatures](https://docs.clover.com/dev/docs/ecomm-hosted-checkout-webhook).
* [Moneris Checkout](https://developer.moneris.com/hosted-solutions/docs/setup-guide).
* [Authorize.net Accept Hosted](https://developer.authorize.net/api/reference/features/accept-hosted.html) and [webhooks](https://developer.authorize.net/api/reference/features/webhooks.html).

## Deployment

Deploy each private `plugins/<id>/` directory with its public browser module. Deploy `modules/dyws/php/Payments/`, the matching plugin host, hook catalog, bundled callback allowlist, admin scripts, styles and regenerated preload manifest together. No schema migration is needed. Leave all new plugins inactive until their sandbox credentials can be configured. Preserve existing plugin activation state, encrypted files, catalogs and SQLite. The public demo must retain its restricted activation allowlist and settings policy.
