# Page loading and diagnostics

Open `/admin/?diagnostics=1` under the installation URL and sign in. The setting travels with admin navigation links. A Load diagnostics disclosure shows the slowest phases and lets you download a JSON timing report. Open a normal admin URL to turn it off.

Reports include navigation time, PHP Server Timing, API call durations, plugin imports and registration, rendering, and same origin resource timings. They contain timing values and sanitized paths only. Request bodies, response data, passwords, tokens, URL queries, fragments, external map URLs and order identifiers are excluded. Measurements stay in memory in the current tab until explicitly downloaded. There is no telemetry service or persistent diagnostic log.

PHP validates the session before loading initial page data. It returns current settings, active plugins, realtime configuration and the data needed for that admin page. Orders rows, report totals and catalog, driver and plugin previews render in PHP. Settings includes the bundled plugin forms. JavaScript enhances the initial content and handles updates, refreshing and saving. Initial data is consumed once per page and never stored in browser storage. Changing report filters fetches a fresh report rather than reusing a mismatched snapshot.

Navigation renders immediately after authentication. Skeletons cover interactive controls during initialization and respect reduced motion. Authenticated HTML and JSON remain uncached. Static assets can be revalidated. Module preload graphs fetch dependencies together; plugin imports overlap while registration and hook ordering remain deterministic.

Run `python3 scripts/build-preloads.py` after changing JavaScript imports or bundled plugin versions. The release builder also runs it. Commit `public_html/platform/preloads.json` with the release.

Initial live baseline on October 23: Orders ready in 1.61 seconds, of which plugin startup took 906 ms; Settings plugin startup took 830 ms. Direct server profiling measured a median 1.7 ms for bootstrap and plugin discovery. Browser timings depend on network conditions and are diagnostic samples, not a performance guarantee.

After the backend startup update, the same live browser measured Orders ready in 378 ms and Settings in 320 ms. Plugin startup fell to 19 ms and 12 ms respectively. Initial same origin request counts fell from 44 to 32 for Orders and from 50 to 34 for Settings. These are matched page samples from this session, not percentile statistics. The `Initial data` measurements read the authenticated PHP response; only `API` measurements represent subsequent transport calls. Report filter changes were verified to make fresh requests.
