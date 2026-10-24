# dyws browser package

Private ES module and CSS package for Do You Want Something. No framework or build step is required. Import index.js to register dyws-ordering and access mountStorefront, mountCatalog, createAPIClient and createTracking. API endpoints, catalog URLs, DOM containers and optional map adapters come from the host.

Load dyws.css in the host document. The cart loads ordering.css relative to this package inside its shadow root. Core imports stay within the package folder. Compatibility exports for optional features point to their bundled plugin assets. Public theme tokens use --dyws and CSS classes use dyws. Import manager.js, orders.js, general-settings.js and driver.js explicitly for their mount functions. settings.js is a compatibility export; the shipped Settings page uses general-settings.js plus plugin forms.

PHP rendering and order services are supplied separately in the private dyws PHP library. Keep that library, its configuration and data outside the public web root. Complete integration examples and compatibility notes live in docs/dyws-module.md in the owning repository.

The current checkout remains a demonstration. It requires an explicitly configured order adapter and accepts test operations only. Native driver apps are not included. The full distribution supplies a browser installer.

### Location and connection adapters

createRealtimeAPI in realtime.js wraps the injected HTTP endpoint with optional WebSocket RPC and scoped subscriptions. createPluginHost in plugins.js loads active optional features. Its location renderer capability supplies a map when a provider plugin is active, and a plain fallback otherwise. GPS capture and delivery tracking remain independent core features.

mountStorefront accepts onOrderComplete(receipt). The demo uses it to navigate to a private order page. Without this callback the existing inline tracking behaviour remains available. mountDriver automatically starts GPS for an assigned active delivery. Browsers may pause capture when hidden; a heartbeat retains the current session without making an old fix look fresh. See docs/gps-maps-realtime.md in the host repository for deployment and API details.

Obtain optional location renderers from createPluginHost in plugins.js. Google Maps implementations and settings now live in ../plugins/google-maps; the old exports are compatibility shims. Deploy the plugin assets with their private PHP counterpart. Core controllers work with no map plugin. The complete plugin API is documented in docs/plugins.md in the repository.

Stripe controls and settings live in ../plugins/stripe. Inject plugins.renderPayment into createTracking, and pass plugins to the storefront and admin controllers to enable the 32 documented hook contracts. See docs/plugin-hooks.md.
