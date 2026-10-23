# dyws plugins

dyws 0.5 introduces installed plugins, an Admin Plugins page, activation and deactivation hooks, PHP actions and filters, registered API routes, and browser contributions. The structure follows the concepts in the [WordPress plugin handbook](https://developer.wordpress.org/plugins/plugin-basics/) and its [lifecycle hooks](https://developer.wordpress.org/plugins/plugin-basics/activation-deactivation-hooks/). These are dyws plugins; WordPress plugin code cannot run unchanged.

## Installation and activation

A plugin has two parts so executable PHP stays private:

- `plugins/<id>/plugin.json` and `plugin.php`, beside server and modules, outside public_html.
- Optional browser assets under `public_html/plugins/<id>/`.

Copy both parts from a trusted source, then open **Admin → Plugins** and activate it. Additional plugins start inactive. The bundled distribution activates Google Maps by default through plugins/bundled.json, preserving existing installations. Activation does not replace its saved API key or Maps settings. Deactivation preserves settings too. Reload other open pages after changing activation. Existing browser tabs are not forcibly reloaded or stripped of already downloaded code.

Plugin state is tenant scoped private JSON beside the database, with revision checking and file locking. A corrupt state file disables plugins and produces an admin warning. Missing or incompatible plugin files do not stop orders. Reinstall a plugin's files before attempting to activate it again. Removing files does not erase its settings.

This first version installs code through Git or file upload using the hosting file manager. There is no browser ZIP uploader, marketplace, automatic updater or uninstall data deletion. The main dyws.zip includes both halves of the bundled Google Maps plugin.

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
use StarlitGo\PluginContext;
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

The context exposes the private site configuration as `$plugin->config`. Keep all files and secrets private. Route callbacks receive the JSON body and authorised session. POST uses the same JSON body limits, bearer authentication and realtime invalidation as core requests. Plugins must add their own validation, resource scoping, rate limits and idempotency where needed.

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
