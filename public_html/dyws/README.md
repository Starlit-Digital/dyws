# dyws browser package

Private ES module and CSS package for Do You Want Something. No framework or build step is required. Import index.js to register dyws-ordering and access mountStorefront, mountCatalog, createAPIClient and createTracking. API endpoints, catalog URLs, DOM containers and optional map adapters come from the host.

Load dyws.css in the host document. The cart loads ordering.css relative to this package inside its shadow root. Core imports stay within the package folder. Compatibility exports for optional features point to their bundled plugin assets. Public theme tokens use --dyws and CSS classes use dyws. Import manager.js, orders.js, general-settings.js and driver.js explicitly for their mount functions. The shipped Settings page uses general-settings.js plus forms from active installed plugins. Stripe compatibility exports are not included.

PHP rendering and order services are supplied separately in the private dyws PHP library. Keep that library, its configuration and data outside the public web root. Complete integration examples and compatibility notes live in docs/dyws-module.md in the owning repository.

The current checkout remains a demonstration. It requires an explicitly configured order adapter and accepts test operations only. Native driver apps are not included. The full distribution supplies a browser installer.

### Location and connection adapters

createRealtimeAPI in realtime.js wraps the injected HTTP endpoint with optional WebSocket RPC and scoped subscriptions. createPluginHost in plugins.js loads active optional features. Its location renderer capability supplies a map when a provider plugin is active, and a plain fallback otherwise. GPS capture and delivery tracking remain independent core features.

mountStorefront accepts onOrderComplete(receipt). The demo uses it to navigate to a private order page. Without this callback the existing inline tracking behaviour remains available. mountDriver automatically starts GPS for an assigned active delivery. Browsers may pause capture when hidden; a heartbeat retains the current session without making an old fix look fresh. See docs/gps-maps-realtime.md in the host repository for deployment and API details.

Obtain optional location renderers from createPluginHost in plugins.js. Google Maps implementations and settings now live in ../plugins/google-maps; the old exports are compatibility shims. Deploy the plugin assets with their private PHP counterpart. Core controllers work with no map plugin. The complete plugin API is documented in docs/plugins.md in the repository.

Stripe controls and settings belong to a separately installed plugin and are not included in this package. Inject plugins.renderPayment into createTracking, and pass plugins to the storefront and admin controllers to enable the 32 documented hook contracts. See docs/plugin-hooks.md.

### Shared presentation

The catalog, cart, admin, driver and setup interfaces share warm action colours, rounded controls and layered surfaces. Set `--dyws-warm` to override the warm accent. Otherwise it is derived from the host text colour and adapts to the existing light and dark palette. Supply the other public `--dyws-*` colour tokens together to retain contrast. Form labels, status text and glyphs remain visible independently of colour. Keyboard focus and full size touch controls are preserved.

Order Reporting and DataTables consume the same presentation tokens. Chart exports retain their standalone colours. The driver run progress element reports completed stops, with the next stop identified in text as well as by its border. No additional stylesheet or JavaScript dependency is loaded for this presentation update.


Remembered guest details are optional. Supply `termsURL` to `mountStorefront` (or the `terms-url` element attribute) to enable checkout controls. Supply the same origin HTTP API, and preserve `{guest: true}` on guest calls and order submission if using a custom adapter. The standard adapter forwards `rememberDetails` automatically. Contact details remain in page memory and private SQLite, with only an opaque HttpOnly cookie in the browser. See `docs/api.md` for the contract and 180 day renewal semantics.
