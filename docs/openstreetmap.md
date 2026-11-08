# OpenStreetMap order overview

OpenStreetMap Orders is a separate optional bundled plugin for manager order geography. It does not replace Google Maps pickup directions or live driver maps. It never reads the driver GPS tables and does not capture device location.

Activate **OpenStreetMap Orders** in Plugins, then open **Order map** in the administration navigation. The existing Reports entitlement is required for geographic datasets and address enrichment. Settings remain manager protected. Deactivation removes the plugin routes and navigation while retaining its saved configuration and geography cache.

## Two independent layers

* **Delivery areas** aggregate saved delivery destinations to 0.01 degree coordinates. These are approximate areas, not precise home pins. Orders in the same area combine across branches unless the business location filter narrows the scope.
* **Pickup locations** count orders at the business location captured in each order snapshot. A pickup point is never the customer's origin. Configure verified business coordinates in Settings, or explicitly locate saved branch addresses through your private Nominatim service.

Date, currency, current status and business location filters are applied on the server in the configured business timezone. Either layer can be hidden independently without changing the underlying query. Counts include cancellations unless filtered; ordered value excludes cancellations and tips. The table exposes exact counts, values and Show on map actions. Empty, unmapped and unmatched orders are counted, never silently converted into points. Results examine at most 10,000 orders, with any omitted count explicitly returned and displayed.

The table and summary remain useful if the basemap is disabled or unavailable. Bubble size is bounded to preserve readability; exact counts are shown for up to 100 visible groups and in the table. When there are more groups, hover or select a point for its count.

## Tile configuration

The plugin bundles Leaflet 1.9.4 locally, including its license and stylesheet. There is no CDN script dependency or Google API key requirement. The default tile URL is `https://tile.openstreetmap.org/{z}/{x}/{y}.png`. Tiles are direct browser images with an origin referrer and ordinary HTTP caching. No offline download, background prefetch, tile scraping or server proxy is provided. OpenStreetMap attribution remains visible at the top of the map. Additional provider attribution is plain text, never executable markup.

OSMF community tile servers have limited capacity and no service guarantee. Follow the [official tile usage policy](https://operations.osmfoundation.org/policies/tiles/). For heavier traffic use your own or a suitably licensed OSM derived tile provider. The tile URL is configurable without a software update. Same origin paths are supported. For another HTTPS provider, add its precise image origin to the host Content Security Policy. The bundled policy permits only the standard OSM tile origin in addition to existing allowed images. Broad external script or connection permissions are not required.

## Private geography and geocoding

Existing DYWS order snapshots do not imply customer coordinates. Configure known pickup coordinates directly or use **Locate missing addresses**. Merely viewing a map never sends saved addresses to a geocoder. The explicit manager action uses the existing Nominatim plugin, version 1.2.0 or compatible, with the host provisioned private endpoint and encrypted credentials. The current Nominatim workflow is Canadian and limited by the host's installed geographic coverage. It never calls the public OSM Nominatim endpoint. Public address suggestion responses remain coordinate free.

Only the saved address is sent, without customer name, phone, email or order identifier. Structured delivery addresses omit unit details for geocoding. No endpoint accepts an arbitrary geocoding URL. Demo lockdown refuses address geocoding. Tests use injected transports and fictional data.

A private tenant scoped `osm_address_geography` table caches an HMAC address key, coordinates, status and update time. Delivery coordinates are rounded before storage; branch geocoding can retain five decimal places. Verified pickup coordinates remain in private plugin settings. Repeated addresses share a cache entry. Unmatched results stay counted. A 30 second address lease prevents concurrent requests from geocoding the same address. Transient failures release the lease and can be retried. Viewing and filtering only read business records; order prices, status, payment records and catalog data are never changed by this plugin.

The browser action processes one address per request, at most 50 per explicit run, with a Stop control. Changing layers or filters stops further work. No continuous background geocoding runs. A request already in flight may finish. To revisit previously unmatched addresses after correcting source data, a changed address naturally receives a new key. Cache retention and backups belong to the installation's private data policy; do not publish the database or runtime settings.

## Manager API

* GET `/manager/plugins/openstreetmap/settings` returns enabled state, tile URL, additional attribution, maximum zoom, verified business points, current business locations and revision.
* POST `/manager/plugins/openstreetmap/settings` validates the same settings and requires the current revision. Conflicts return 409. HTTPS tile URLs or same origin paths must contain `{z}`, `{x}` and `{y}` exactly once. Attribution is plain text. Business coordinates must be finite and within geographic bounds.
* GET `/manager/plugins/openstreetmap/dataset` accepts `from`, `to`, `currency`, `status`, `fulfillment` and `location`. Dates are inclusive and limited to 366 days. Fulfillment is all, pickup or delivery. Location is `*` for all branches, an ID, or an empty value for the default historical business. Results include scoped totals, per-layer coverage, approximate aggregate groups, status counts, `orderedValueExcludingTips` in integer cents, missing reasons and geocoder readiness. No contacts, street addresses, order IDs or driver coordinates are returned.
* POST `/manager/plugins/openstreetmap/geocode` accepts `{ "query": { ...filters } }`. It processes at most one unique pending address. Manager authentication and Reports entitlement are checked before any address service call. Requests are rate limited to 60 per minute. Returns processed, located and unmatched counts, without source addresses or coordinates. Unconfigured or demo geocoding returns 503. Invalid filters return 422.

All routes require manager bearer authentication. Drivers and anonymous callers are denied. Tenant scope is enforced in every business record and cache query. Dataset reads use a consistent SQLite read snapshot.

## Verification

`npm test` includes geography, settings, layer model, geocoding and authenticated HTTP lifecycle checks. They cover cancellation/value semantics, missing addresses, approximate delivery points, precise configured business points, cross-tenant isolation, date/status/fulfillment filters, revision conflicts, invalid URLs and coordinates, explicit geocoding, duplicate address caching, concurrent leases, driver GPS exclusion, Pro entitlement and deactivation retention. No automated test contacts external geocoding or tile services.

For a local fictional preview, run `php tests/fixtures/openstreetmap-preview.php /private/tmp/new-osm-fixture`, then start the ordinary development router with `DYWS_CONFIG=/private/tmp/new-osm-fixture/config.json`. The fixture uses port 8249 and refuses existing directories. Its 110 orders and two businesses are fictional. Never run a fixture initializer on a merchant installation.

References: [Leaflet stable API](https://leafletjs.com/reference-1.9.4.html), [OSMF tile policy](https://operations.osmfoundation.org/policies/tiles/), [OSM attribution guidelines](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines).

The map keeps date controls and layer switches visible. Currency, current status, branch filtering and the less frequent address enrichment action sit under Filters. The view is read only until a manager explicitly saves settings or starts address enrichment.
