# DYWS browser package

Private ES module and CSS package for Do You Want Something. No framework or build step is required. Import index.js to register dyws-ordering and access mountStorefront, mountCatalog, createAPIClient and createTracking. API endpoints, catalog URLs, DOM containers and optional map adapters come from the host.

Load dyws.css in the host document. The cart loads ordering.css relative to this package inside its shadow root. All JS imports and CSS imports stay within the package folder. Public theme tokens use --dyws and CSS classes use dyws. Import manager.js, settings.js and driver.js explicitly for their mount functions.

PHP rendering and order services are supplied separately in the private DYWS PHP library. Keep that library, its configuration and data outside the public web root. Complete integration examples and compatibility notes live in docs/dyws-module.md in the owning repository.

The current checkout remains a demonstration. It requires an explicitly configured order adapter and accepts test operations only. Native driver apps and automated installation are not included.

### Location and connection adapters

createRealtimeAPI in realtime.js wraps the injected HTTP endpoint with optional WebSocket RPC and scoped subscriptions. createLocationRenderer in google-maps.js provides a reusable renderLocation adapter, one map per view, with a short memory GPS cache. Pass your own reference map fallback. The SDK loads only with an enabled key. An injected defaultCenter can show the business area while waiting for GPS. map settings and GPS source belong to the DYWS package, not the diner theme.

mountStorefront accepts onOrderComplete(receipt). The demo uses it to navigate to a private order page. Without this callback the existing inline tracking behaviour remains available. mountDriver automatically starts GPS for an assigned active delivery. Browsers may pause capture when hidden; a heartbeat retains the current session without making an old fix look fresh. See docs/gps-maps-realtime.md in the host repository for deployment and API details.
