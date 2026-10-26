# dyws hook reference

dyws includes 40 built in hook features. The current application release is recorded in [VERSION](../VERSION). The names below are live integration points. The machine readable catalog is modules/dyws/php/hooks.json and is also returned by GET /plugins. Actions, filters and validators use priorities, default 10, with lower values first.

## Server hooks

Register these in a private plugin's PHP entry with addAction, addFilter or addValidator. Arrays are passed by value. Filters return the replacement array; actions ignore their return value. Validators return normally to allow the operation, return false to reject it, or throw dyws\ApiError with a useful message. Unexpected validation errors return 503, never a successful order.

| # | Hook | Kind | Callback arguments and purpose |
|---|---|---|---|
| 1 | plugin.activated | Action | `(id)` after activation state is saved. Initialize integrations or observe another plugin. Use onActivate for the plugin's own setup before activation commits. |
| 2 | plugin.deactivated | Action | `(id)` to remaining active plugins after deactivation. Use onDeactivate for the departing plugin's own cleanup. Settings are preserved. |
| 3 | catalog.public | Filter | `(catalog)` after inactive products are removed. Add public metadata and presentation hints. Core still prices orders from its private catalog. |
| 4 | catalog.validating | Validator | `(catalog)` after core catalog validation and manager authorization, before saving. Enforce merchant specific product rules. |
| 5 | catalog.saved | Action | `(catalog, revision)` after a successful save. Notify an index or invalidate an external cache. |
| 6 | order.validating | Validator | `(order, totals)` for a new order after core field validation and authoritative integer pricing, inside its transaction. Order includes canonical lines, customer, fulfillment, address and optional pluginData. Totals include subtotal, tax, deliveryFee, total and currency. No new validation on an already successful idempotent retry. |
| 7 | order.created | Action | `(receipt, store)` after persistence. Receipt includes ID and tracking token; do not publish it. Retried successful submissions can invoke this again. Deduplicate work by order ID. |
| 8 | order.status_changing | Validator | `(order, nextStatus, actor)` after core permissions, assignment, payment and transition checks, before writing inside the transaction. A plugin may impose additional restrictions, never authorize an invalid transition. |
| 9 | order.status_changed | Action | `(order, store)` after the authorised status request succeeds. Attach operational notifications or audit work. |
| 10 | order.assigned | Action | `(order)` after the manager saves an assignment. Use the assigned driver ID to queue delivery work. |
| 11 | tracking.public | Filter | `(tracking)` only after the customer's tracking token passes. Add customer safe status details. Core does not include private pluginData, contact information or credentials in this projection. |
| 12 | reports.summary | Filter | `(report)` after manager authorization and date validation. Add labelled metrics while preserving core totals and their definitions. |
| 13 | api.response | Filter | `(result, route, method)` after a successful endpoint. Add namespaced response metadata. Do not expose private fields or turn an unpaid record into a paid response. |
| 14 | api.respond | Action | `(route, method, result)` immediately before successful serialization. Observe response metadata without replacing authentication or error handling. |
| 15 | lookup.results | Filter | `(result, context)` for manager only GET `/manager/lookup?q=...&kind=...`. Context contains query and kind. Result contains results. Core supports all, products, orders and drivers; add your own kind and bounded results here. |

Lookup results use `{kind, id, label}` with optional safe metadata. Queries are capped at 100 bytes. Native results are tenant scoped and bounded to 40, with at most 20 orders. SQL wildcard characters in user queries are treated literally. Plugins should keep their own results bounded too. No customer or driver may call this manager endpoint.

Validators must be quick and deterministic. Do not send email, charge a card, make a network request or start a nested database transaction inside validation. Use post persistence actions for external work, with a durable queue and deduplication appropriate to the integration. Observation hooks are not a reliable job queue. An exception in an optional observer is logged and does not undo the order.

Declare `"capabilities": ["validation"]` for required server checks. Saved plugin state remembers this requirement even if its files disappear. Explicit deactivation disables those checks; missing or broken active required code rejects affected writes. Managers can still inspect and repair the installation.

## Browser hooks

The plugin entry exports register(plugin). Browser actions and filters may be async; validators are awaited before checkout submission. The shipped controllers pass the shared plugin host to every relevant screen.

| # | Hook | Kind | Callback arguments and purpose |
|---|---|---|---|
| 16 | admin:settings | Action | `({root, api})` on the signed in Settings screen. Mount the plugin's own form in `[data-dyws-plugin-settings]`. Its API must independently authorize managers. |
| 17 | admin:navigation | Filter | `(pages, {current, role})`. Return `[id, label, relativeURL]` entries to add admin pages. The host accepts same origin HTTP links only. A link does not grant access to its destination. |
| 18 | admin:dashboard | Action | `({root, report})` after an authenticated dashboard refresh. Add compact report widgets. Root is a dedicated plugin area. |
| 19 | admin:order | Action | `({root, order})` for each authorised manager order card. Display plugin data or controls using your authenticated endpoints. |
| 20 | catalog:item | Action | `({root, item})` after product render or server rendered hydration. Add badges, availability hints or extra details. Core Add controls and prices remain intact. |
| 21 | cart:updated | Action | `({lines, totals})` when quantities change, items are removed or the cart clears. This event contains cart items, not customer details. It does not override server pricing. |
| 22 | checkout:fields | Action | `({root, form, pluginData})` before the checkout form becomes submittable. Add labelled fields in root and write values under your plugin ID in pluginData. |
| 23 | checkout:validating | Validator | `({form, order, pluginData})` before submission and idempotency fingerprinting. Throw a useful Error to keep the cart and show the message. Repeat essential rules with order.validating on the server. |
| 24 | tracking:updated | Action | `({root, order})` after a successful scoped tracking refresh, including final delivery or pickup completion. Display additional status information. No tracking token is passed to this display hook. |
| 25 | driver:orders | Action | `({root, orders})` after an authenticated driver refresh. Orders contain only that driver's current assignments. Add delivery tools without starting GPS outside the existing active delivery policy. |

Display roots are replaced between renders. Write only inside the supplied root, use textContent for untrusted text, and make repeated rendering safe. A delayed callback retains its old detached root rather than gaining access to a newer card. Optional display errors are isolated. A required browser validation plugin that fails to import blocks checkout validation; server checks still provide the authority.

The context supplies document, api, addAction, addFilter, addValidator, their corresponding remove methods, provide and onDestroy. Late registration is supported. Keep the original callback reference to remove it. onDestroy releases plugin timers and listeners when the host is destroyed.

## Checkout fields and storage

The request accepts pluginData as an object keyed by plugin ID. Each plugin value must be an object or array; the whole bag is limited to 20 plugins and 8192 encoded bytes. It is included in the order's idempotency fingerprint and stored in SQLite. Managers and assigned drivers receive it as pluginData; customer tracking omits it unless a plugin explicitly adds a safe projection. Do not put credentials or unrelated sensitive information in this bag. It is not saved in browser cart storage.

```php
return static function (dyws\PluginContext $plugin): void {
    $plugin->addValidator('order.validating', function (array $order): void {
        $note = $order['pluginData']['gift-note']['message'] ?? '';
        if (!is_string($note) || strlen($note) > 200) {
            throw new dyws\ApiError('Keep the gift note within 200 bytes.');
        }
    });
    $plugin->addFilter('reports.summary', function (array $report): array {
        $report['giftNotePlugin'] = ['available' => true];
        return $report;
    });
};
```

```js
export function register(plugin) {
  plugin.addAction('checkout:fields', ({root, pluginData}) => {
    const label = plugin.document.createElement('label');
    label.textContent = 'Gift note';
    const input = plugin.document.createElement('textarea');
    input.maxLength = 200;
    input.addEventListener('input', () => {
      pluginData['gift-note'] = {message: input.value};
    });
    label.append(input);
    root.append(label);
  });
}
```

A complete example is in examples/plugins/gift-note. It is shipped as example source, not installed or active by default.

## Capabilities beyond the hooks

Plugins can also register namespaced HTTP routes with public, manager or driver access, offer payment providers, supply payment renderer controls, and supply a location renderer with route estimates. Bundled Google Maps and separately installed payment plugins use these APIs. Stripe is not included in the distribution. See [Plugin architecture](plugins.md) for route limits, raw request handling, retained signed callbacks, activation and deactivation, and the trusted code boundary. WordPress PHP plugins do not run unchanged in dyws.

## Reporting and table hooks

| # | Hook | Runtime and type | Contract |
|---|---|---|---|
| 26 | reports.dataset | PHP filter | `(dataset, context)` after the Order Reporting plugin reads a consistent tenant, date, currency and fulfilment scoped snapshot. Add namespaced aggregates without contacts, GPS or credentials. |
| 27 | reports.generated | PHP action | `(dataset, context)` after dataset filters. Observe completion, do not modify orders or charge. Runs only with Order Reporting active. |
| 28 | admin:report-controls | Browser action | `({root, refresh})` once during manager mounting. Root is the report toolbar. Add labelled controls and call refresh after selection. No token is passed. |
| 29 | reports:query | Browser filter | `(query)` with initial `{from,to}` before the authenticated report request. Return query parameters. Server authorization remains mandatory. |
| 30 | reports:cards | Browser filter | `(cards,{report})` inside Order Reporting. Cards use plain `{label,value,detail}` text, escaped by the renderer. |
| 31 | reports:export | Browser filter | `(rows,{key,report})` before CSV escaping. Return an array of row arrays. Keys include summary, items and daily. Summary receives the core report; other exports receive its orderReporting dataset. Numeric money is integer cents. Strings are quoted and spreadsheet formula prefixes neutralised after filters. |
| 32 | admin:tables | Browser action | `({root,phase})`, phase mount or dispose. Enhance only marked tables inside root on mount; destroy owned instances before replacement on dispose. Never attach handlers to order action buttons. |

The browser provider `reports.renderer` receives `{root,report,applyFilters,runAction}`. Return true after rendering or false to use core reports. Errors fall back to the core view. Core authentication and order controls remain independent. Order Reporting supplies this provider; DataTables subscribes to admin:tables, so either plugin can be disabled independently. Report renderers must dispose table instances before replacing their DOM. The host also disposes on a rendering error.

PHP reporting context is `{from,to,currency,fulfillment,timeZone}`. Date bounds are epoch seconds with an exclusive end. The dataset includes its schemaVersion. These plugin owned dataset hooks are available only when that plugin runs; the toolbar, query, summary export and renderer provider are core integration points.

The `admin:tables` browser action also accepts a generic `table[data-dyws-table="stable-key"]`. Optional arguments are `options` for DataTables configuration, `ready(instance, table)` to attach table controls, and `forget: true` with the dispose phase to discard in memory state on logout or destruction. Existing report table markers remain supported. The core order board works without an enhancement handler. Handlers receive private admin DOM only after manager login.

## Mandatory installation policies and input presentation

These five additional PHP contracts bring the catalog to 37. Installation, request and authentication policy checks run when private configuration declares `required_plugins`. They run before the relevant handler, and do not replace core authorization. Pin any access policy in that private list so missing code fails closed. Ordinary installations can still inspect and repair a broken optional order validator.

| # | Hook | Kind | Arguments and timing |
|---|---|---|---|
| 33 | installation.validating | Validator | `(config)` during bootstrap after creating the store, before returning any page data. Verify installation invariants. Required policies run first. |
| 34 | request.validating | Validator | `(method, route, body)` after JSON decoding, before any API handler. A mandatory installation policy can deny unknown endpoints or critical mutations. |
| 35 | auth.validating | Validator | `(body)` before core password verification and session creation, for both API and PHP form sign in. Add requirements; never bypass the core credential check. |
| 36 | order.input | Filter | `(body)` before field validation, pricing and idempotency fingerprinting. Normalize input. Pair enforced restrictions with `order.validating`, since optional filters isolate errors. |
| 37 | page.presentation | Filter | `(presentation, page)` on sign in pages. Fields are plain text `notice`, `username`, `driverId` and `gpsMessage`. PHP escapes every displayed value. |

## Optional order layout provider

The browser provider `order.layout` receives a stage ID, `cart`, `checkout` or `review`, and returns a synchronous declarative layout or `null`. Order Format loads its assigned layouts during registration and provides this capability. The storefront includes this feature in its PHP page requirements.

A layout is `{rows, fields: [{id, row, column, span, align, vertical}]}`. Rows are 1 through 30, columns and spans are 1 or 2, alignment is `left`, `center` or `right`, and vertical alignment is `top`, `center` or `bottom`. Positions must not overlap. The core allowlist and essential fields are exported by `public_html/dyws/order-layout.js`; the plugin schema mirrors that contract. Action groups always span both columns.

The core validates the entire layout before moving its existing DOM controls. Invalid or absent layouts leave the built in stage intact. This provider cannot replace validation, amounts, event handlers or submission behavior. Checkout extension roots and status messages are preserved. This is a provider capability, not an additional action or filter in the hook catalog.

## Payment connector hooks

| # | Hook | Kind | Contract |
| --- | --- | --- | --- |
| 38 | payments.connector | PHP filter | `(result, providerId)`. Result is an array containing `connector`, a trusted server Connector instance, or empty. `Plugins::paymentConnector(id)` resolves it. Never serialize this object or return credentials to a browser. |
| 39 | payments.connector_verified | PHP action | `(providerId, safeResult)` after a successful sandbox connection check. |
| 40 | payments.connector_event | PHP action | `(providerId, verifiedEvent)` after provider signature verification and duplicate body suppression. Observation only, never an authorization to charge or mark an order paid. |

See [payment connector contracts](payment-connectors.md) for operations, settings APIs, limitations and provider documentation. Connector activation does not select a payment provider for checkout.
