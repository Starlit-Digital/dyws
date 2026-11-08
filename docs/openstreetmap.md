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

## Persistent address cache

`AddressCache` provides one normalization and write path for geocoder results and trusted imports. Keys use the existing tenant secret, fulfillment layer, case normalization and collapsed whitespace. Cached successful and unmatched results persist in SQLite across requests and service restarts. Page loads never perform lookups. Existing atomic address leases prevent duplicate concurrent requests; unsuccessful transport requests remain retryable. Trusted imports can preload public address points without contacting a geocoder. Delivery coordinates retain the same approximate precision. No reverse geocoding runs when markers are viewed.

Cache verification covers imported coordinates, normalized key reuse, a newly constructed service using existing rows, positive and negative hits making zero geocoder calls, and coordinate bounds.

## Map interaction

Configured business coordinates appear as restaurant pins, independently of order layer visibility. Each has a 3000 metre geodesic circle showing straight line radius, not route distance or checkout enforcement. The initial fit includes the full ring. Business pins show the business name, address and radius. Order bubbles and table actions open a compact popup with count, value excluding tips, cancelled count and status breakdown for the current filters. The map provides a native fullscreen toggle with a viewport fallback, Escape exit, focus return for the fallback, and resize cleanup. The same popups remain available in fullscreen.

Mousewheel zoom is enabled only while the map is fullscreen, including the viewport fallback. Leaving fullscreen restores ordinary page scrolling.

## Delivery density heatmap

The map provides a local canvas heatmap, enabled by default. Only visible delivery groups contribute; pickup business coordinates never stand in for customer origins. Each group contributes its order count to a Gaussian field with a 550 metre standard deviation. Neighbouring fields add continuously. A continuous OKLCH green ramp uses the same lightness, chroma and hue endpoints as the hourly demand table. Empty geography is transparent so the basemap remains readable.

The scale is normalized from the source areas for the selected report filters and remains fixed while panning. The legend is relative density, not an exact count for an arbitrary point. Approximate 0.01 degree source areas and smoothing may blend across the 3 km ring. No exact homes, new geocoding, external heatmap service, or additional customer data are used. The exact counts remain in the table and location popups. Switching the heatmap off restores numbered order bubbles.

One control strip contains delivery and pickup layers, heatmap, fit, filters and refresh. Dates, currency, status and business location live in the Filters popover. The strip is included in native and fallback fullscreen. Wheel zoom remains fullscreen only. Canvas work is bounded to a reduced resolution raster, scheduled after map moves, zooms and resize, and disposed with its listeners on teardown. Numeric tests verify order weighting, neighbouring blending, empty areas, source normalization and colour continuity.

Client host integration must reuse the established business logo, shared theme, header, navigation, typography and controls. Inspect existing host pages before adapting this plugin page. The bundled framework shell is not a finished client design. Keep client branding adaptations in the owning client repository and verify them alongside its existing pages.

## Map PDFs and archive

The map strip's Export menu offers Download PDF, Save to archive and Open archive. Both PDF actions save immutable bytes to the existing Order Reporting archive under target `order-map`. Order Reporting must be active. The client applies any pending filter edits before capture, and otherwise keeps the current viewport. Selected delivery/pickup layers, heatmap state, date range, currency, status, business location, viewport bounds, zoom, business coordinates and source snapshot identifier are recorded in the archive settings.

Capture composes the browser's already requested tiles and local overlays, including restaurant pins, radius, density legend and OpenStreetMap attribution. It never requests an offline area, proxies tiles or geocodes an address. The provider must allow browser CORS canvas use. Missing tiles, a moving map or a provider that forbids image export produce an error instead of a misleading blank PDF. A bounded JPEG keeps the request within the existing 256 KiB plugin body limit.

`POST /manager/plugins/openstreetmap/export` is manager only, 30 exports per hour, with a 262144 byte request limit. Body: `query` (the dataset's scope), `snapshotId`, `layers` (unique delivery/pickup values), `heatmap` (boolean), `view` (`bounds`: south/west/north/east and integer `zoom`) and `image` (a JPEG data URL, at most 245000 characters). Rasters are limited to 150 through 1600 pixels per dimension and two million pixels. SVG, HTML and remote image URLs are not accepted. The server regenerates scoped aggregates and rejects stale snapshots with HTTP 409. It does not trust browser supplied totals or business details. PDF rendering disables remote resources, PHP and JavaScript.

The landscape PDF includes full configured business details, a selected filter/layer summary, authoritative selected layer totals and a centred UTC timestamp, random reference and page count through the existing PdfIdentity helper. The image is a browser captured visual, not a server audited reproduction. Totals cover the whole filtered period; the captured viewport can show a subset. The existing archive search can filter target `order-map` and search the saved settings. Original byte integrity and tenant isolation are unchanged.

Verification includes bounded raster validation, authorization, stale snapshot rejection, saved filters/layers, archive search and original downloads. The Calle Mexico preview was verified with all layers plus heatmap and with delivery only, heatmap off and cancelled orders, without changing any of its 502 orders.

## Separate map pages and report overview

The maps export includes the combined view when both layers are selected, then separate delivery locations, delivery density when enabled, and pickup locations. Deselected layers are omitted. Reports includes an Order locations panel with the same saved session selections and an Include in overview PDF control, enabled by default. The overview appends separate selected map pages to the normal report panels. Each page retains the chosen status, location, report range and viewport.

The browser stages each bounded capture through manager only `POST /manager/plugins/openstreetmap/captures` (262144 bytes, 120 per hour), using the original validated single image request contract. It receives a tenant scoped capture ID. The export endpoint also accepts `captures` (one through four unique IDs) and `kind` (`maps` or `overview`). Captures must share scope and viewport; source snapshots are revalidated before final export. Temporary files are private, expire after 15 minutes and are consumed on success. Archive snapshots preserve each page in `mapViews`, alongside the combined `mapView`. The legacy single image export remains supported. No additional tile areas or address lookups are requested.
