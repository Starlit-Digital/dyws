# QUERY report pilot verification

29 October 2026. Local application and client verification, no deployment.

## Delivered behavior

`reports.summary` has explicit QUERY admission and the existing POST execution
path. Both methods use the same scoped service and schema. Discovery adds
versioned transport metadata while preserving the existing POST field. The
private config setting `integration_query_enabled: false` disables QUERY.

`public_html/dyws/integration-reports.js` discovers support, prefers QUERY and
falls back once on 405 or 501. It remembers unsupported transport for five
minutes. It also supplies a POST override, a total deadline, cancellation and
optional metrics with no credentials, filters or report content. It does not
retry authentication, validation, rate limit or ambiguous network failures.

`scripts/report-summary.mjs` provides a usable machine client with environment
configuration and optional transport events. See [the API guide](integration-api.md#query-reporting-pilot).

## Completed checks

* Final `npm test` completed with exit code zero. All 172 JavaScript tests passed,
  including 22 dedicated report client tests. The PHP and Python suites also
  passed, including 109 integration API checks.
* The actual public PHP endpoint was exercised under CGI with QUERY and raw
  JSON input. Fixed fictional order data produced identical QUERY and POST
  reports. Different date ranges produced different correct aggregates.
* Missing credentials, missing scope, revoked and expired keys, wrong tenant,
  malformed JSON, unsupported content type, oversized input and rate limits
  were checked. QUERY write routes and export were rejected. Server disabled
  mode advertised POST and returned 405 for QUERY while POST still worked.
* The reusable client and CLI were exercised against the normal development
  HTTP server. Its QUERY rejection triggered POST fallback and returned the
  expected report. A second request through the same client used remembered
  POST capability.
* Client fixtures covered HTML 405/501 responses, old discovery, forced POST,
  bounded fallback, negative capability expiry, cancellation, stalled headers
  and bodies, authentication and service failures, and observer failures.
* PHP syntax checks, JavaScript syntax checks and `git diff --check` passed.

The test output is local at `/tmp/dyws-query-tests-final-20261029.log`. It is a
temporary execution log, not a published artifact or permanent telemetry store.

## Limits and next measurement

The PHP development HTTP server rejects QUERY before application dispatch.
CGI tests demonstrate application support without pretending that server
acceptance has changed. Production server, proxy, WAF, browser and CORS
compatibility were not tested. No live key was issued or used. The existing
manager reporting UI remains on its current GET API.

No speed improvement was measured. There is no new result cache. Before making
performance claims, run a controlled canary through one actual reporting
consumer, keep a POST control cohort, and compare equal inputs and cache policy.
Measure direct QUERY success independently of fallback, final success, p95
latency and request cost. The API guide records suggested acceptance gates.

Existing unrelated and uncommitted project work was retained. No commit, push,
release publication, installation or deployment was performed.
