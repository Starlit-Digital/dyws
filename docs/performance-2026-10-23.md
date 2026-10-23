# Live page timing review, October 23, 2026

Three repeat navigations per page, using the same browser before and after. Values are median time to interactive controls, in milliseconds. Admin, storefront and customer tracking used the in app browser. The driver console used the signed in Chrome session. Samples are diagnostic comparisons, not service level guarantees. Google Maps readiness is measured separately.

| Page | Before | After | Initial same origin requests, before → after |
| --- | ---: | ---: | ---: |
| Storefront | 970 ms | 211 ms | 49 → 30 |
| Orders | 303 ms | 214 ms | 32 → 30 |
| Reports | 314 ms | 220 ms | 31 → 27 |
| Catalog | 306 ms | 219 ms | 34 → 19 |
| Drivers admin | 309 ms | 203 ms | 34 → 24 |
| Password | 304 ms | 210 ms | 34 → 19 |
| Settings | 296 ms | 220 ms | 34 → 29 |
| Plugins | 300 ms | 208 ms | 34 → 19 |
| Customer tracking | 284 ms | 218 ms | 32 → 29 |
| Driver console | 305 ms | 207 ms | 30 → 24 |

The storefront had the largest avoidable delay: redundant public startup requests and a serial plugin import chain. PHP now supplies the public catalog, settings and manifest, while the ordering component reads its provided snapshot. Native PHP Provides and Requires attributes select page features. Admin editors load per page; CSS imports, including the DataTables vendor stylesheet, are discovered early. Browser assets for unrelated bundled plugins are absent from the selected page manifest.

Driver map readiness in the three repeated Chrome samples was 294, 218 and 217 ms from navigation start. There were no active deliveries, so this validates the business reference map rather than a driving route calculation. An earlier first navigation after deployment took 1.05 seconds, including an unexplained gap before assets started; its server first response was 103 ms and PHP took 22 ms. It did not recur in the repeated samples. Do not treat the repeat medians as cold mobile or tail latency measurements.

Anonymous auth, driver sign in and /admin entry were also checked through HTTP. They returned sign in forms with no private boot data; /admin redirected to /auth. The existing authenticated administrator session was preserved. Auth is a plain PHP form with no application startup JavaScript. Setup is removed on the installed demo and was verified through the extracted installer tests instead.

Remaining variable work is external map initialization and driving route lookup, plus network conditions and browser scheduling. Core PHP initial data and browser plugin registration were small in these samples. Private HTML and API data remain uncached; there is no telemetry collection.

The cart quantity controls are right aligned. Remove uses a labelled trash icon with a minimum 48 pixel button target.
