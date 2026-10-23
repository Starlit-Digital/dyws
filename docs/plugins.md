# dyws plugins

dyws 0.5 introduces installed plugins, an Admin Plugins page, activation and deactivation hooks, PHP actions and filters, registered API routes, and browser contributions. The structure follows the concepts in the [WordPress plugin handbook](https://developer.wordpress.org/plugins/plugin-basics/) and its [lifecycle hooks](https://developer.wordpress.org/plugins/plugin-basics/activation-deactivation-hooks/). These are dyws plugins; WordPress plugin code cannot run unchanged.

## Installation and activation

A plugin has two parts so executable PHP stays private:

- `plugins/<id>/plugin.json` and `plugin.php`, beside server and modules, outside public_html.
- Optional browser assets under `public_html/plugins/<id>/`.

Copy both parts from a trusted source, then open **Admin → Plugins** and activate it. Additional plugins start inactive. The bundled distribution activates Google Maps, Stripe, Order Reporting and DataTables by default through plugins/bundled.json, preserving existing installations. Activation does not replace its saved API key or Maps settings. Deactivation preserves settings too. Reload other open pages after changing activation. Existing browser tabs are not forcibly reloaded or stripped of already downloaded code.

Plugin state is tenant scoped private JSON beside the database, with revision checking and file locking. A corrupt state file disables plugins and produces an admin warning. Missing optional display plugins do not stop orders. Required payment and validation failures reject affected operations. Reinstall a plugin's files before attempting to activate it again. Removing files does not erase its settings.

This first version installs code through Git or file upload using the hosting file manager. There is no browser ZIP uploader, marketplace, automatic updater or uninstall data deletion. The main dyws.zip includes both halves of all four bundled plugins.

## Manifest

```json
{
  "id": "sample",
  "name": "Sample",
  "version": "1.0.0",
  "apiVersion": 1,
  "description": "An example plugin.",
  "entry": "plugin.php",
  "browserModule": "index.js",
  "stylesheet": "style.css"
}
```

The ID must match its directory, using lowercase letters, digits and hyphens, beginning with a letter. Browser module and stylesheet are optional. Entry filenames are basenames, not paths or external URLs. PHP entry directories and files must not be symlinks. Plugin API version 1 is supported.

## PHP registration

`plugin.php` returns a registration function. Keep registration free of persistent writes; it runs on requests when the plugin is active.

```php
<?php
use dyws\PluginContext;
return static function (PluginContext $plugin): void {
    $plugin->route('GET', '/plugins/sample/hello', 'public',
        fn () => ['message' => 'Hello']);
    $plugin->route('POST', '/manager/plugins/sample/settings', 'manager',
        function (array $body, ?array $session): array {
            // Validate input and write private settings here.
            return ['saved' => true];
        });
    $plugin->onActivate(function (): void {
        // Create optional resources idempotently.
    });
    $plugin->onDeactivate(function (): void {
        // Stop optional work. Preserve user settings and data.
    });
    $plugin->addAction('order.created', function (array $receipt, $store): void {
        // Observe a successful order submission.
    });
};
```

Routes use `/plugins/<id>/...` or `/manager/plugins/<id>/...`. GET and POST are supported. Access is public, manager or driver, enforced by the core before calling the handler. Every `/manager/` route requires manager access. The bundled alias map retains the old Maps URLs for compatibility. Plugins cannot register arbitrary core routes.

The context exposes the private site configuration as `$plugin->config` and the tenant Store as `$plugin->store`. Keep all files and secrets private. Route callbacks receive the JSON body and authorised session. POST uses the same JSON body limits, bearer authentication and realtime invalidation as core requests. Plugins must add their own validation, resource scoping, rate limits and idempotency where needed.

Hooks use ascending priority, default 10. `addAction(name, callback, priority)` observes events; `addFilter(name, callback, priority)` returns an updated array. Available core events are `order.created(receipt, store)`, `order.status_changed(order, store)` and `api.respond(route, method, result)`. The `api.response(result, route, method)` filter runs before serialization. Hooks can also be invoked by a host through `doAction` and `applyFilters`.

Order hooks run after successful persistence, including successful retries of an idempotent request. They are not an exactly once job queue. Use an order ID and a durable deduplication record for external side effects. Do not issue charges from response hooks. Lifecycle callbacks must also be idempotent. Activation failure leaves activation state unchanged, but plugin authored side effects are the plugin's responsibility. Errors in observation hooks are logged and do not undo a completed order. Broken plugin registration is isolated; deactivation is still permitted when loading its code fails.

## Browser hooks

`createPluginHost({api})` reads the active manifest from GET `/plugins`, imports only its local browser modules and loads their styles. A plugin's index.js exports:

```js
export function register(plugin) {
  plugin.addAction('admin:settings', async ({root, api}) => {
    // Mount a settings form in [data-dyws-plugin-settings].
  });
  plugin.provide('location.renderer', options => {
    // Return render(position, role, options), with clear() and destroy().
  });
}
```

The registration context provides api, document, addAction, addFilter and provide. Registration is staged so a module that throws does not leave partially registered contributions. Failed plugins do not prevent later plugins from loading. The host exposes runAction, applyFilters and errors. Plugins use dyws prefixed CSS and should clean up their listeners and resources.

The location renderer receives latitude, longitude, accuracy and recorded_at. Rendering options include destinationAddress and onEstimate. Estimates use durationMillis and calculatedAt. Call onEstimate(null) when no estimate is available. Clear pending requests and displayed positions when clear() is called. The customer tracker decides whether a status is terminal and never uses an ETA to complete an order. Without a map plugin, core tracking displays its status and a map unavailable message. Driver GPS collection, authentication, orders and the delivery state machine remain core functions.

## Google Maps plugin

Google SDK loading, map instances, markers, traffic routes, estimate calculation, map CSS, settings form and PHP settings persistence all live in the bundled plugin. Its endpoints are:

- GET `/plugins/google-maps/config`, public, returning the enabled browser key.
- GET and POST `/manager/plugins/google-maps/settings`, manager only.
- `/maps/config` and `/manager/maps`, compatibility aliases while active.

The original private maps JSON filename is retained, so no key migration or reentry is needed. The old dyws/google-maps.js and maps-settings.js exports and PHP MapsSettings.php file are compatibility shims only. Core and website controllers use the plugin host and do not import the Google implementation. A host that directly uses a compatibility export must include the bundled plugin files too.

The host's existing CSP allowlist permits Google Maps resources. Hosts installing a different provider must configure its origins in their own server headers. Deactivation stops new plugin loading and API access; it does not revoke a public browser key already downloaded by a visitor. Restrict the key in Google Cloud as usual.

## Trust boundary

Plugins execute trusted PHP and JavaScript with the site's authority. Activation is not a sandbox or security review. Only the site owner should install code, and only managers can change activation. Never install third party code supplied by a customer or driver. The framework protects route namespaces and caller roles, but a trusted plugin can access configuration and the database directly.

## Stripe plugin, version 0.6

Stripe's PHP settings, encrypted credential storage, Checkout integration, webhook verification and reconciliation, browser payment controls, and settings form live in plugins/stripe and public_html/plugins/stripe. Core no longer imports Stripe services or dispatches Stripe routes. The old PHP classes and browser exports are compatibility includes.

Admin → Plugins → Stripe → Settings opens its form in Settings. The form is available at settings/#plugin-stripe. The saved encrypted private stripe.json path and encryption context remain unchanged, so keys do not need reentry. Blank secret inputs preserve saved values. Stripe remains sandbox only. The existing pinned Composer SDK is included in the ZIP.

The bundled plugin is active by default, but checkout stays off until its saved settings enable it. The explicit upgrade default adopts Stripe on installations that saved plugin state before Stripe became a plugin. Saving plugin state records known IDs so later deactivation is respected. This never enables checkout by itself or changes saved credentials. Additional plugins remain inactive until a manager activates them.

### Payment lifecycle

`$plugin->providePayment(fn() => 'provider-id')` offers a payment provider for new orders. Return null when not enabled. Selection is exclusive: two selected providers, broken active payment plugins and unreadable credentials reject new orders with 503 rather than creating manual orders. Declare `"capabilities": ["payments"]`. Core snapshots the selected provider and refuses manager test capture for any online provider, even while its plugin is disabled. Existing idempotent order receipts keep their original provider.

Disabling Stripe stops new checkout endpoints and browser payment controls. The host bundle explicitly retains only its two signed webhook endpoints. This lets already submitted payments, asynchronous confirmations and refunds reconcile after deactivation. It does not execute its other hooks or settings endpoints while inactive. Keep the plugin files, signing secret and Stripe webhook endpoint until every payment is settled. Removing files is different from deactivation and makes callbacks unavailable. A signed callback alone can update payment state; returning from Checkout cannot.

Core owns durable provider neutral payment attempts, event deduplication and refund deltas so tracking and reports remain accurate without optional plugin code. Existing stripe_attempts, stripe_events and stripe_refund_deltas tables are renamed transactionally to payment_attempts, payment_events and payment_refund_deltas on first use. Amounts, keys, sessions and history are preserved. Restore a consistent database backup as well as code when rolling back across this migration.

### Routes and rendering

- GET/POST `/manager/plugins/stripe/settings`, manager only.
- POST `/manager/plugins/stripe/verify`, manager only, rate limited.
- POST `/plugins/stripe/orders/{orderId}/checkout`, tracking token required and rate limited.
- POST `/plugins/stripe/webhook`, raw body signature verified.
- Legacy `/manager/stripe`, `/manager/stripe/verify`, `/orders/{orderId}/checkout` and `/stripe/webhook` remain compatible.

The public browser capability is `payment.renderer.stripe`. The core tracker injects an active provider's renderer through `plugins.renderPayment`. Missing plugins show a payment unavailable or pending message, with no manual capture shortcut. Payment links are accepted only on Stripe's HTTPS Checkout host.

Plugin route callbacks receive `(body, session, request)`. Request contains `raw`, the exact request bytes, `params` for named path segments, and `server` for request headers. Use `{name}` for one alphanumeric, underscore or hyphen path segment, then validate the resource ID in the handler. Route options accept `maxBody` up to 262144 bytes and `rateLimit: [bucket, count, seconds]`. Authentication happens before handler invocation and rate limiting. Only the trusted bundled manifest can allow old route aliases and retained callbacks.

## 25 built in hooks

See [Hook reference](plugin-hooks.md) for all 25 hooks, payloads, timing and examples. GET /plugins advertises the same catalog from modules/dyws/php/hooks.json. Core and website adapters call these hooks; they are not reserved names without implementations.

Actions observe or display. Filters return an adjusted value. Validators can reject an operation. Priorities run in ascending order, default 10; equal priorities retain registration order. PHP and browser contexts support addAction, addFilter, addValidator and corresponding remove methods. PHP observation errors are logged, browser errors are collected, and other optional hooks continue. Validators fail the operation, preserving the cart or server transaction. Declare validation capability so a failed or missing required plugin cannot silently bypass server checks. Browser checks improve the form; repeat required rules on the server.

The PHP context also exposes store for tenant scoped storage and read access. A host can set private config plugins_path to a separate trusted plugin directory. Never accept that path from HTTP. Callback authors are responsible for using store.tenant in every query and for avoiding private data in public filters. Authentication is never bypassed by a hook, and hooks only receive the successful scoped projection for public tracking. Plugins remain trusted code with the site's privileges.

The browser context offers onDestroy for cleanup. Pass the plugin host as plugins to mountStorefront, mountCatalog, mountManager, mountDriver and createTracking. The shipped diner does this already. Display callbacks receive a fresh dedicated root at each render, so delayed work cannot replace core buttons or a newer status. Dispose resources and listeners when the host is destroyed. Hooks can run repeatedly because of polling; replace content within the supplied root and deduplicate external side effects.

Example source in examples/plugins/gift-note includes a checkout field, browser and server validation, a product note and manager order display. Copy private/ to plugins/gift-note and public/ to public_html/plugins/gift-note, then activate it. It is an example only and is not active in the hosted diner.

## Order Reporting and DataTables

Version 0.7 bundles Order Reporting and DataTables as independent optional plugins. New installations activate both. Existing installations adopt them once through upgradeDefaults; later deactivation persists. Reports stay at reports/. Disabling Order Reporting restores core summaries while Orders remains on its own page. Disabling DataTables leaves semantic tables with CSV exports and SVG charts. DataTables loads its local library only when a marked admin table needs it, with no CDN request, analytics, stored search state or commercial add ons.

See [reporting definitions and PayCal research](order-reporting.md) and [hook contracts](plugin-hooks.md). No runtime order migration or external reporting service is required.
