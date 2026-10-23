# GPS, maps and live connections

Implemented October 23, 2026. These are demonstration orders and browser GPS, not a native background tracking service.

## Driver workflow

The driver signs in at driver.html and sees assigned orders with their addresses. GPS starts automatically for an assigned order whose status is out_for_delivery. There are no sharing or simulation buttons. Picking up a ready order also starts GPS. If several deliveries are active, this prototype keeps the currently tracked order, or selects the first active order returned by the API. Batch delivery tracking is not implemented.

The browser requires HTTPS and location permission. A blocked permission is explained on screen; allowing permission in browser settings resumes capture. The page must stay visible. The browser may pause position acquisition when hidden. The app keeps the active delivery session alive without changing the last measurement timestamp, and resumes when the browser provides a fix. Signing out or completing the delivery stops capture. Login alone does not upload positions without an active delivery. The venue's employment policies are outside this prototype.

Browser positions retain the device measurement timestamp. We never make an old fix look fresh. Fixes over 60 seconds old, invalid coordinates and accuracy worse than 5 km are discarded by the client. Moving uploads are coalesced to at most one every five seconds. Identical coordinates and accuracy reuse the recent position until a 30 second heartbeat. Transient network errors retry the latest fresh fix with bounded backoff. Browser permission denial or revoked authentication stops capture.

## GPS cache and privacy

The backend stores one latest measurement per active delivery, not a trail. A sharing session is bound to the assigned driver's current login and an additional random sharing token. It expires after two minutes without an authenticated upload or heartbeat. Heartbeats do not alter measurement timestamps. Stop, logout, reassignment eligibility changes or delivery completion remove access. A late stop request from a previous share cannot stop a replacement share.

Each API request prunes expired sharing sessions and their measurements. The cleanup CLI also prunes them; a scheduler is not installed by this change. With no requests or cleanup run, an expired record can remain physically in SQLite until the next pruning pass, but cannot be returned by the HTTP API. Existing trusted PHP callers without a sharing session retain their legacy 15 minute cleanup limit.

Browser display caches contain only the latest fix in memory, retain a last known fix for at most 15 minutes while the server confirms the active sharing session, and clear on explicit stop updates, order completion or sign out. No GPS is written to localStorage, sessionStorage or an HTTP cache. Authenticated and tracking JSON responses retain Cache-Control: no-store. A disconnected viewer clears the last known marker after two minutes without another successful snapshot; it does not claim that marker is current. Stale fixes are labelled after 60 seconds.

Google content is not copied into our cache. Google manages its SDK and tile caching. Each view keeps one map and marker, updating their position rather than constructing a new map at each poll. The reports dashboard has one map with an order selector. The Drivers tab has one map per driver with an active GPS fix, placed on the right on desktop and below on mobile. Each map is reused across updates. Switching orders reuses the map. Repeated identical fixes also reuse the reference view. Configuration is fetched once per view; reload after changing the key.

## Google Maps setup

Open Settings in the admin area. The Google Maps section accepts a browser key, an enabled checkbox and a map ID. The map loads when enabled. Driver cards and the driver console retain a business area base map without a driver marker while waiting for a position. The existing Manning reference map and a coordinate link remain available without a key or when script loading fails. Google tile rendering and the driving route were verified on the hosted Drivers tab and private customer order page with the owner supplied key.

For this prototype:

1. Sign into a personal Google Account, not a Workspace account.
2. Visit https://developers.google.com/maps/documentation/javascript/demo-key and choose Get a Demo Key.
3. Review Google's terms and obtain the key. Google says this prototype option requires no billing information, with daily quotas and no overage charges. Quotas can change.
4. Paste the key into admin Settings, Google Maps. Leave Map ID as DEMO_MAP_ID, enable Maps and save.
5. Reload the admin dashboard and a private order tracking page while a delivery is active.

For production, create a Google Cloud project, connect billing, enable Maps JavaScript API and Routes API, then create a browser API key. Apply Websites restrictions for https://sltd.ca/* and restrict the key to Maps JavaScript API and Routes API. Add another exact origin only when actually used. Create a JavaScript map ID for production. Routes computes the driving path using the full delivery address. A separate Geocoding or Places integration is not needed for this route display. Do not use server or unrestricted keys. Browser keys are public by design. The admin summary masks an existing key; an enabled public map configuration necessarily includes it.

As checked October 23, 2026, standard Dynamic Maps pricing includes 10,000 free loads per month, then US$7 per 1,000 loads in the next tier. At 20,000 monthly loads that is US$70 before taxes, credits or other services. A page visit that creates a map is a load; updating the existing marker does not create another map instance. Reloads and separate tabs create new instances. Reusing a map does not make every Google service free.

Before a production launch, provide public Terms of Use and a Privacy Policy meeting Google's Maps requirements and preserve SDK attribution. No paid account or billable key is created by this deployment.

## WebSocket hosting later

Hostinger shared hosting continues to serve PHP. The optional Node relay is prepared in modules/dyws/realtime for the separate server the owner will provide. It is not installed on PayCal or on Hostinger. All pages currently use HTTPS polling on the hosted demo.

Run on the future server with Node 22 or newer:

```sh
cd modules/dyws/realtime
npm ci --omit=dev
# Set these using the host's private environment configuration:
# DYWS_BACKEND_URL=https://sltd.ca/diner/api/index.php
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

The driver console shows the order and address on the left, map on the right, stacked on mobile. The Drivers tab shows a map per driver. Customer and reports maps use the same module. Routes Library computeRoutes receives the origin and order address, requests only path, draws a driving polyline and places a destination marker at the route's road access endpoint. That point is not a surveyed property boundary or guaranteed doorstep. No arrival time is promised.

The currently displayed route is reused. It is recomputed when the destination changes or the driver has moved at least 100 metres, at most once a minute for the same destination. Google route results are not stored in files or browser storage. A new page can request its own route. The user's private address exists only in the requested hosted test order, not in committed code or test fixtures.

Checkout now collects street, optional unit, city, region, postal code, country and phone. The backend validates and combines the address, keeps structured fields in address_json and preserves older clients that submit a freeform address. The cleanup job scrubs both address formats. The migration adds address_json without replacing orders.

The inherited Hostinger CSP blocked Google scripts on the first live attempt. The diner .htaccess now overrides it within /diner/, allowing the Maps SDK from maps.googleapis.com and maps.gstatic.com, Google map data, fonts and styles. Other site folders are unchanged.
