# dyws module integration

dyws owns the reusable JavaScript, CSS and PHP backend. The diner is a host application that supplies placement, configuration, branding and its reference map.

## Package locations

* `public_html/dyws/`: browser ES modules and scoped CSS, package `@starlit-digital/dyws` version 0.2.0. Copy this folder to a public assets location. Its imports and shadow styles resolve within that folder.
* `modules/dyws/php/`: private PHP library, including catalog validation and rendering, order storage, schema, API dispatch and plugin hooks. Copy this folder outside the web root. Include `module.php` once. Merely including it performs no output, database work or API dispatch.
* `server/`: existing deployment configuration and CLI adapters. Compatibility includes preserve the existing dyws class names. Setup and cleanup remain deployment commands, not public routes.
* `public_html/demo.js`, `demo-map.js` and `platform/*.js`: small host adapters. The diner images, map projection, simulation coordinates, display preferences and HTML page content belong to the website.

Neither package is published to a public registry. The PHP library requires PHP 8.1 or later and PDO SQLite for order storage. Stripe requires the Composer autoloader and the existing pinned SDK dependency. Load that autoloader before dispatching payment requests.

## PHP rendering calls

```php
require_once '/srv/private/dyws/module.php';
$catalog = dyws_load_catalog('/srv/private/catalog.json');

// Choose the full menu, or place selected panels separately.
echo dyws_render_menu($catalog, ['id' => 'menu']);
```

For a page with its own layout, use these calls instead:

```php
echo dyws_render_category($catalog, 'breakfast');
// Host content can go here.
echo dyws_render_category($catalog, 'sweet');
echo dyws_render_item($catalog, 'sweet1');
```

IDs come from the JSON catalog. Category names can be entrées, desserts, tools or anything else. A category function returns only that category and its available items. An item function returns one product, including any options. Each call returns its own `dyws-catalog` wrapper, with `dyws-category` panels and `dyws-product` rows inside. They use the same CSS and cart. Do not repeat the same category ID on a single page because its anchor must be unique. Repeating a featured product is supported and its quantity controls stay in sync.

All functions return HTML rather than echoing it. Text and attributes are escaped, image URLs and catalogs are validated, inactive products are excluded and selected option prices are displayed. Unknown category or item IDs throw `InvalidArgumentException`. `dyws_render_navigation($catalog)` returns category links for a host supplied nav. `DYWSRenderer` exposes equivalent menu, category, item and navigation methods if a host wants to validate a catalog once and render several parts.

Rendering requires only the catalog JSON. `dyws_catalog_from_config($privateConfigPath)` is an optional helper that loads the configured catalog without starting the order service. Do not use request parameters as configuration file paths. Never serialize private configuration into HTML.

## Add the browser behavior

Load `assets/dyws/dyws.css`, include a `<dyws-ordering catalog="api.php?route=/catalog" storage-key="my-shop-cart"></dyws-ordering>`, and initialize from a host JavaScript file:

```js
import {mountStorefront, createAPIClient} from './assets/dyws/index.js';

const app = mountStorefront({
  ordering: document.querySelector('dyws-ordering'),
  container: [...document.querySelectorAll('[data-dyws-rendered]')],
  api: createAPIClient(new URL('./api.php', import.meta.url)),
  hydrate: true,
  tracking: {container: document.querySelector('main'), storageKey: 'my-shop-tracking'}
});
```

`hydrate: true` attaches cart controls to PHP output and preserves the host's chosen panels. It does not replace those panels with a second full menu. Without PHP, pass an empty container and omit hydrate to render the catalog in JavaScript. `navigation` and `loading` elements are optional. Catalog prices are refreshed from the API before controls are enabled. The backend always prices the actual order. Without JavaScript the PHP menu remains readable, with ordering controls disabled.

`mountCatalog`, `createTracking`, cart helpers and `createAPIClient` are also exported separately. `mountStorefront` returns a destroy method that detaches its event handlers and tracking polling. Tracking accepts an optional `trackingPage` URL and `renderLocation(location)` callback returning a DOM node; without a map adapter it displays the GPS coordinates and status. No diner map or coordinates are inside the package.

`mountManager`, `mountOrders`, `mountDriver` and `mountSettings` are explicit exports from their respective JS modules. They accept a supplied `api`, a DOM `root` matching the existing admin form markup, and a configurable session storage key. Importing these modules does not start them or inspect the page. The driver simulation requires a supplied position function; it does not begin GPS sharing on import. These controllers still use the current admin markup contract. Standalone native driver apps and an installer are separate future work.

The public element is `<dyws-ordering>` and its JavaScript class is `DYWSOrdering`. PHP services use the lowercase `dyws` namespace. Browser cart, session and tracking keys use the dyws prefix. Configure `DYWS_CONFIG` and `DYWS_BOOTSTRAP` when overriding private paths. Older names are removed. The CSS package is now part of `@starlit-digital/dyws`; styles are explicitly exported at `./dyws.css`.

## Backend endpoint

A host supplies a dedicated PHP API entry point:

```php
require_once '/srv/private/vendor/autoload.php';
require_once '/srv/private/dyws/module.php';
dyws_serve_api('/srv/private/config.json');
```

The same private catalog file must be used by rendering and the order API. The API dispatcher retains session authorization, tenant and driver scope, rate limits, server pricing, idempotency, tracking token checks and plugin route authorization. Stripe signature verification belongs to its bundled plugin. Existing configuration fields and routes are documented in api.md and deployment.md. `dyws_bootstrap($configPath)` returns the configuration and Store for trusted server integrations. The legacy environment variable remains supported, with DYWS_CONFIG available as an alternative. API dispatch belongs in the endpoint, not in a homepage render call.

See `examples/php-host/` for a separate shop host using one category and one featured product. It was verified using copied packages outside the diner repository, including a test order saved by its own PHP backend.

## Admin editing modules

The admin host has separate pages for reports, catalog, drivers, password, settings and plugins. The tab navigation uses links with aria-current rather than ARIA tabs, because each destination is a separate page. The host passes its URLs into mountAdminNavigation; package modules do not decide where the website's pages live.

The browser exports catalog-editor.js, account-editor.js, stripe-editor.js and admin-navigation.js. They initialize against a supplied root and API client. The catalog editor clones the loaded JSON into an in-memory draft and edits categories, names, descriptions, image URLs and descriptions, prices, SKU, unit, availability and option names/prices. Category, item and option creation, removal and ordering preserve existing IDs. Hidden metadata is retained. Save uses the existing revision guarded catalog endpoint and server validation. Money is entered in dollars and converted to integer cents. Image uploads are not implemented; use existing relative paths or HTTPS URLs.

Drivers can be added, renamed, have a password reset, or be deactivated. The admin password page requires the current password and confirms the new password. New account persistence lives in AdminAccounts.php. Stripe owns its settings form in the Settings page. The settings/ PHP page contains the Stripe plugin form. The old mountSettings export remains for existing integrations.

## Configurable team role labels

The public `role-labels.js` module provides `loadRole(api)`, `defaultRole` and `applyRoleLabels(root, role)`. Mark host text elements with `data-dyws-role-text` templates containing `{role}` or `{roles}`. These are text substitutions, never HTML. Inject the loaded `role` into `mountManager`, `mountDriverAdmin` and `createTracking`. Map renderers receive it as their second argument. Labels refresh on page load; other open tabs should reload after a rename.

`mountGeneralSettings({root, api, storageKey, onSave})` in `general-settings.js` mounts the authenticated Settings editor. The PHP `dyws\Settings` class persists tenant scoped labels independently of accounts and the catalog. This is a display name for the existing assignment role, not a permissions editor or multiple custom roles.

`mountManager` now mounts only the Reports dashboard. `mountOrders` from orders.js mounts the order table, detail actions and active deliveries using the same manager session storage key. Both support direct sign in and independently refreshed data.
