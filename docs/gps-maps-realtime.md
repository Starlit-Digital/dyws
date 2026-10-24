# GPS, maps and live connections

This guide describes the current implementation identified by [VERSION](../VERSION). Browser GPS is available for demonstration deliveries; reliable native background tracking is not implemented.

## Driver workflow

The driver signs in at driver/ and sees assigned orders with their addresses. GPS starts automatically for an assigned order whose status is out_for_delivery. There are no sharing or simulation buttons. Picking up a ready order also starts GPS. If several deliveries are active, this prototype keeps the currently tracked order, or selects the first active order returned by the API. Batch delivery tracking is not implemented.

The browser requires HTTPS and location permission. A blocked permission is explained on screen; allowing permission in browser settings resumes capture. The page must stay visible. The browser may pause position acquisition when hidden. The app keeps the active delivery session alive without changing the last measurement timestamp, and resumes when the browser provides a fix. Signing out or completing the delivery stops capture. Login alone does not upload positions without an active delivery. The venue's employment policies are outside this prototype.

Browser positions retain the device measurement timestamp. We never make an old fix look fresh. Fixes over 60 seconds old, invalid coordinates and accuracy worse than 5 km are discarded by the client. Moving uploads are coalesced to at most one every five seconds. Identical coordinates and accuracy reuse the recent position until a 30 second heartbeat. Transient network errors retry the latest fresh fix with bounded backoff. Browser permission denial or revoked authentication stops capture.

## GPS cache and privacy

The backend stores one latest measurement per active delivery, not a trail. A sharing session is bound to the assigned driver's current login and an additional random sharing token. It expires after two minutes without an authenticated upload or heartbeat. Heartbeats do not alter measurement timestamps. Stop, logout, reassignment eligibility changes or delivery completion remove access. A late stop request from a previous share cannot stop a replacement share.

Each API request prunes expired sharing sessions and their measurements. The cleanup CLI also prunes them; a scheduler is not installed by this change. With no requests or cleanup run, an expired record can remain physically in SQLite until the next pruning pass, but cannot be returned by the HTTP API. Existing trusted PHP callers without a sharing session retain their legacy 15 minute cleanup limit.

Browser display caches contain only the latest fix in memory, retain a last known fix for at most 15 minutes while the server confirms the active sharing session, and clear on explicit stop updates, order completion or sign out. No GPS is written to localStorage, sessionStorage or an HTTP cache. Authenticated and tracking JSON responses retain Cache-Control: no-store. A disconnected viewer clears the last known marker after two minutes without another successful snapshot; it does not claim that marker is current. Stale fixes are labelled after 60 seconds.

Google manages SDK and tile caching. dyws reuses the current route result in memory only; it does not persist route results in files or browser storage. Each view keeps one map and marker, updating their position rather than constructing a new map at each poll. Orders has an active delivery map with an order selector. Reports contains charts and tables, not delivery maps. Drivers has a location panel per driver, on the right on desktop and below on mobile; an available fix adds the driver marker. Each map is reused across updates. Switching orders reuses the map. Repeated identical fixes also reuse the reference view. Configuration is fetched once per view; reload after changing the key.

## Google Maps setup

Open Settings in the admin area. The Google Maps section accepts a browser key, an enabled checkbox and a map ID. The map loads when enabled. Driver cards and the driver console retain a business area base map without a driver marker while waiting for a position. An available fix has a coordinate link fallback without a key or when script loading fails. The static Manning area reference image belongs to the diner footer; it is not the current live map fallback. Google tile rendering and the driving route were verified on the hosted Drivers tab and private customer order page with the owner supplied key.

Enable the bundled Google Maps plugin in Admin → Plugins, then open its form in Settings. Save the browser key, enabled state and map ID. A blank key field preserves the saved key. Reload map views after changing configuration. `DEMO_MAP_ID` is the example map ID, not an API key.

The implementation loads Maps JavaScript and its Routes library. Configure a browser key for those services in the Google project and apply website restrictions for the actual installation origin. The hosted example uses `https://sltd.ca/*`; another installation needs its own origin. Browser keys are public by design. The admin summary masks the saved value, but the enabled public map configuration necessarily includes it.

Follow Google's current [key setup](https://developers.google.com/maps/documentation/javascript/get-api-key), [key restrictions](https://developers.google.com/maps/api-security-best-practices) and [demo key eligibility](https://developers.google.com/maps/documentation/javascript/demo-key) guidance. Account eligibility, quotas, billing requirements and prices are controlled by Google. Check the [current pricing](https://developers.google.com/maps/billing-and-pricing/pricing) for both maps and route requests instead of relying on a fixed estimate in this repository.

Reusing a map and marker avoids reconstructing them on each poll, but separate tabs and fresh navigations create their own map instances. Route refreshes can make additional service requests. Preserve attribution and review Google's [display and privacy requirements](https://developers.google.com/maps/documentation/javascript/policies) for deployment. dyws does not create a Google account or billing project.

## WebSocket hosting later

The hosted demo serves PHP and uses HTTPS polling. The optional Node relay lives in modules/dyws/realtime and requires a separately deployed service; installing the PHP site does not start it.

Run on the future server with Node 22 or newer:

```sh
cd modules/dyws/realtime
npm ci --omit=dev
# Set these using the host's private environment configuration:
# DYWS_BACKEND_URL=https://sltd.ca/diner-demo/api/
# DYWS_REALTIME_SECRET=<at least 32 random characters, shared with PHP>
# DYWS_ORIGINS=https://sltd.ca
# HOST=127.0.0.1
# PORT=8099
# DYWS_TRUST_PROXY=true
node server.js
```

Place it behind a TLS reverse proxy supporting WebSocket upgrades. Proxy /dyws and /publish to loopback port 8099. Replace, rather than append, client supplied X-Forwarded-For when DYWS_TRUST_PROXY is enabled. Never expose the loopback listener directly. Restrict /publish by the shared secret and preferably network policy. Use an actual chosen hostname, not the example below. Add this to private config.json only after the service is reachable:

```json
{"realtime":{"url":"wss://chosen-host.example/dyws","publishUrl":"https://chosen-host.example/publish","secret":"same-private-random-secret"}}
```

The shared secret stays in private PHP config and the relay environment. Browser clients receive only the public WebSocket URL. The relay forwards JSON to one fixed PHP API, preserving authorization and rate limiting identity. It validates allowed origins, payload sizes, request concurrency and message rates. Subscription authorization expires and is rechecked. Notifications contain only invalidations, never coordinates, contact details or order payloads. Every data request still authorizes in PHP.

The JS API client uses WebSocket RPC when configured and reachable, then normal HTTPS otherwise. A lost socket retries safe reads, never an uncertain submitted mutation. Order creation retains its idempotency key. Customer polling runs every five seconds, operator boards every ten, and admin editors and the storefront every fifteen. WebSocket subscriptions periodically resynchronize. Editor notifications preserve unsaved fields.

## Verification

Run npm test and npm run test:realtime after npm ci in modules/dyws/realtime. The relay test launches a temporary PHP backend and actual WebSocket server, checks roles and private tracking subscriptions, publishes simulated GPS, compares admin and customer coordinates, verifies stop removal, rejects a foreign origin, stops the relay and checks HTTP fallback and order idempotency. Browser tests use fictional orders and simulated backend coordinates, not the operator's device location.

## Primary references

* https://www.w3.org/TR/geolocation/
* https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition
* https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_client_applications
* https://github.com/websockets/ws
* https://developers.google.com/maps/documentation/javascript/demo-key
* https://developers.google.com/maps/documentation/javascript/get-api-key
* https://developers.google.com/maps/api-security-best-practices
* https://developers.google.com/maps/documentation/javascript/advanced-markers/start
* https://developers.google.com/maps/documentation/javascript/load-maps-js-api
* https://developers.google.com/maps/documentation/javascript/policies
* https://developers.google.com/maps/billing-and-pricing/pricing
* https://www.hostinger.com/support/hostinger-node-js-limits-for-web-and-cloud-plans/

## Destination, route and fixed test origin

The owner enabled a fixed Manning Town Centre origin in private config under driver_test_location, with latitude, longitude, accuracy and name. This is a demo override, never a hidden fallback for failed device GPS. Remove that setting to restore device GPS. It is deliberately absent from the committed production defaults. Authenticated driver polling maintains a simulated position only for assigned active deliveries, and every viewer labels it as simulated. It expires after the driver disconnects or signs out. Real uploaded coordinates are replaced by the configured test coordinates while this override is active.

The driver console shows the order and address on the left, map on the right, stacked on mobile. The Drivers tab shows a map per driver. Customer and Orders maps use the same plugin module. Routes Library computeRoutes receives the origin and order address, requests path, durationMillis and distanceMeters with traffic aware driving, draws a driving polyline and places a destination marker at the route's road access endpoint. That point is not a surveyed property boundary or guaranteed doorstep. No arrival time is promised.

The currently displayed route is reused. For the same destination, recomputation waits at least one minute, or two minutes when a route is already drawn and movement is under 100 metres. A destination change can trigger a new request immediately. Google route results are not stored in files or browser storage. A new page can request its own route. Use fictional addresses in examples and tests; keep customer destinations in authorized order data.

Checkout now collects street, optional unit, city, region, postal code, country and phone. The backend validates and combines the address, keeps structured fields in address_json and preserves older clients that submit a freeform address. The cleanup job scrubs both address formats. The migration adds address_json without replacing orders.

The inherited Hostinger CSP blocked Google scripts on the first live attempt. The diner .htaccess now overrides it within /diner-demo/, allowing the Maps SDK from maps.googleapis.com and maps.gstatic.com, Google map data, fonts and styles. Other site folders are unchanged.

## Customer arrival and completion

The customer tracking page shows Received, Preparing, Ready, On the way and Delivered. Pickup uses Collected as its final stage. A terminal backend status is the only completion signal; proximity and elapsed estimates never finish an order. A driver selecting Complete delivery records delivered through the existing authorised status API. The customer receives it through WebSocket invalidation or the existing five second HTTPS polling fallback. Completion clears the location view and estimate, stops tracking subscriptions, and leaves a dated confirmation on screen.

Arrival estimates use the Google Maps JavaScript Routes library with DRIVING, TRAFFIC_AWARE and fields path, durationMillis and distanceMeters. This uses the existing browser key and enabled Routes API. See Google's [Routes reference](https://developers.google.com/maps/documentation/javascript/reference/route). Requests reuse the existing map and in memory route for at least one minute, or two minutes while movement is under 100 metres. Google route data is not saved to local storage or the server. API usage remains billed under the configured Google project.

No preparation time is invented. Before departure, the customer sees that an estimate will become available after departure. Once underway, a fresh GPS fix and a route duration produce an approximate number of minutes and arrival time. Simulated GPS is explicitly labelled Demo arrival estimate. GPS older than 60 seconds, route results older than two minutes, network failures and unavailable routing suppress the estimate. The page never claims arrival merely because the estimated time passed.

The public `/diner-demo/` install overrides this with Demo Lockdown: no Google Maps SDK, geocoding, routing, device GPS or billable API calls. It displays the bundled Manning reference image and a fixed simulated position. Other installations retain the Google Maps plugin and their configured permissions.
