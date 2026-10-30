# DYWS integration API v1

This API lets a business owner authorize AI services to discover commands and retrieve aggregate reports. A business owner is a tenant manager, separate from a diner customer account. All routes use the existing `/api/?route=...` endpoint, including installations under a subdirectory. Use HTTPS outside local development. Send secrets only through `Authorization: Bearer <secret>`, never URLs, prompts, logs or browser storage. Responses use `Cache-Control: no-store`. JSON POST requests require `Content-Type: application/json`.

## Issue the owner's provisioning key

Using an existing manager session bearer token:

```http
POST /api/?route=/manager/api-keys
Authorization: Bearer <manager-session>
Content-Type: application/json

{"name":"Owner provisioning","scopes":["keys:manage","reports:read","reports:export"]}
```

The response contains `key` metadata and a `secret` beginning with `dyws_`. Save the secret immediately, it appears only in this creation response. SQLite stores only its SHA256 digest. Default expiry is 90 days, maximum expiry is one year. Supply `expiresAt` as integer Unix seconds to choose an earlier expiry. Manager creation defaults to `reports:read` when scopes are omitted.

Managers can list all tenant key metadata with `GET /manager/api-keys` and revoke a key with `POST /manager/api-keys/{keyId}/revoke`, body `{}`. Listing returns 100 records per page and `nextOffset`, use `&offset=N` for subsequent pages. Expired and revoked records remain visible for administration. Repeated revocation succeeds. Revoke a key and create its replacement to rotate it. This initial plumbing has no key management browser page.

## Discover and call commands

Authenticate with the provisioning key, then request:

```http
GET /api/?route=/integrations/v1/commands
Authorization: Bearer <provisioning-key>
```

The response includes `apiVersion`, `tenant` and the commands permitted by this key. Each command includes its ID, description, required scope, execution method and route, JSON input schema, output description and `readOnly` indication. Retrieve one definition with `GET /integrations/v1/commands/{id}`. Execute with `POST /integrations/v1/commands/{id}/execute` and a JSON object containing the arguments directly. Unknown arguments are rejected. This is an HTTP command API, an MCP server or provider specific AI connector is a separate adapter.

| Command | Required scope | Arguments |
| --- | --- | --- |
| `keys.create` | `keys:manage` | `name`, `scopes`, optional `expiresAt` |
| `keys.list` | `keys:manage` | Optional `offset`, returns `nextOffset` |
| `keys.revoke` | `keys:manage` | `keyId` |
| `reports.summary` | `reports:read` | Optional `from`, `to` |
| `reports.export` | `reports:export` | Optional `from`, `to`, `format` |

To create an AI service key, execute `keys.create`:

```json
{"name":"AI reporting assistant","scopes":["reports:read","reports:export"]}
```

Give the returned service secret to that service. Its discovery response contains only its permitted report commands. Delegated keys cannot manage keys. Their scopes must be a subset of their parent's report scopes and their expiry cannot exceed their parent's expiry. Provisioning keys can list and revoke only their own children. Managers can manage all tenant keys. Revoking a provisioning key revokes its children, and authentication also verifies the parent's current expiry and revocation state. At most 100 unexpired, unrevoked keys can exist per tenant.

## Reports and exports

Example `reports.summary` arguments:

```json
{"from":"2026-10-01","to":"2026-10-07"}
```

Dates are inclusive business dates in the configured business timezone, with a maximum difference of 365 days. `from` defaults to today, `to` defaults to `from`. The response includes schema version, tenant, timezone, range, `moneyUnit: "cents"` and `report` containing the existing core aggregate sales, payments, tips, status counts and top items. Core ordered value and ordered tips include cancelled orders, while top item quantities and subtotals exclude cancelled orders. Captures and refunds use payment dates, which may differ from order dates. Counts by status and fulfillment include cancelled orders. Currency and the demonstration marker come from core reporting. Definitions remain those used by `Store::reports`.

`reports.export` accepts the same dates plus `format: "json"` (default) or `"csv"`. It returns `filename`, `contentType`, `encoding: "base64"`, and `content`. Decode `content` to obtain the file. JSON contains the same report envelope as `reports.summary`. CSV contains tenant/range/timezone metadata, then section, metric, value rows, with nested aggregate records encoded as JSON cells. Spreadsheet formula prefixes are escaped. Exports are generated in memory and are never placed at public URLs.

Reports use the core aggregate directly. They do not return customer contacts, individual orders, tracking tokens, driver locations, or optional plugin report fields. Optional reporting plugins, PDF downloads, emailed reports, order mutations and payment actions are outside this initial command allowlist. Adding commands requires explicit schema, scope, handler and authorization tests in `IntegrationApi.php`; existing manager and plugin routes never become machine commands automatically.

## Errors and operations

Errors retain the platform JSON envelope `{"error":"..."}`. Missing, invalid, revoked, expired or wrong tenant keys return 401. Unavailable commands and excess scopes return 403. Missing or inaccessible child keys return 404. Invalid input returns 422, malformed JSON 400, non JSON POST 415, oversized bodies 413, key capacity 409, and rate limits 429.

Integration requests have an IP authentication limit of 240 per minute and an authenticated per key limit of 120 per minute, using existing persistent rate limit buckets. Manager key administration has an IP limit of 60 per minute. Key creation and revocation are transactional. A private SQLite audit records key lifecycle events and successful or denied command executions, with tenant, actor, action and timestamp. It excludes secrets, request inputs and report content, and prunes entries older than 90 days during audit writes. Discovery and failed authentication are not audit events.

The schema is installed idempotently by normal Store initialization. Deploy the changed core PHP files and schema together. Preserve the private database and configuration. No runtime credentials are shipped. Run `python3 tests/integration-api.test.py` and `npm test` before deployment. This change does not provision live keys or deploy itself.

## QUERY reporting pilot

Only `reports.summary` additionally accepts HTTP `QUERY`, with the identical JSON
body, bearer scope, tenant isolation, limits, audit and result contract as POST.
POST remains supported. Exports, key commands, orders, payments and plugin routes
do not gain QUERY support. This pilot adds no result cache and retains `no-store`.
See [RFC 10008](https://www.rfc-editor.org/rfc/rfc10008.html) for the method.

Discovery preserves `method: "POST"` for existing clients and adds this field to
the summary command only:

```json
{"transport":{"version":1,"preferredMethod":"QUERY","supportedMethods":["QUERY","POST"],"fallbackMethod":"POST"}}
```

Set `integration_query_enabled` to JSON `false` in the private config to force
POST. Discovery then advertises only POST and an authenticated QUERY summary
receives 405 with `Allow: POST`. No schema migration or data changes are needed
to switch back. Omission defaults to enabled at the application boundary. This
does not prove the web server or intermediary admits the method.

DYWS multiplexes logical routes through a single `/api/` path. The pilot does
not advertise path wide `Accept-Query` support because that could incorrectly
imply all logical commands accept QUERY. Clients use the explicit summary
capability instead. No cross origin CORS policy is added. Prefer same origin or
machine clients and verify any separate CORS configuration before browser use.

### Preferred client with POST fallback

The reusable ES module `public_html/dyws/integration-reports.js` supports only
the summary command. It works in Node and appropriate browser environments.
Do not embed a private service credential into public browser code. Keep issued
keys in the authorized service's secret storage and pass them in memory:

```js
import {createIntegrationReportClient} from './public_html/dyws/integration-reports.js';

const reports = createIntegrationReportClient(process.env.DYWS_API_URL, {
  token: process.env.DYWS_REPORT_KEY,
  onMetric: event => recordPrivateTransportMetric(event)
});
const data = await reports.summary({from: '2026-10-01', to: '2026-10-07'});
// Operator override, applied to subsequent requests:
reports.setForcePost(true);
```

For an immediate machine client, run `node scripts/report-summary.mjs
2026-10-01 2026-10-07` with `DYWS_API_URL` and `DYWS_REPORT_KEY` already supplied
by the authorized service environment. It prints the private aggregate as JSON
to stdout. Optional `DYWS_REPORT_METRICS=1` prints transport events to stderr;
`DYWS_REPORT_FORCE_POST=1` forces POST. With no dates it requests today's report.
It never accepts a credential as a command argument or writes a report file.
Each CLI invocation has fresh capability memory, so use the long lived module
for ongoing requests and transport measurement.

Use the installation's exact `/api/` endpoint, including its subdirectory. The
client requires HTTPS outside loopback, omits ambient cookies and refuses
redirects. Discovery is authenticated, cached for five minutes per client
instance, and old discovery without the capability uses POST. A supported
summary uses QUERY first. An HTTP 405 or 501 retries once as POST with the same
body and key, then selects POST for five minutes before rediscovery. HTML method
errors are handled without assuming the response is JSON. Construct one client
per endpoint and credential so negative capability memory is useful.

Authentication, validation, rate limit, route and ordinary server errors are
surfaced without a transport downgrade. Network failures are also surfaced;
they do not prove method incompatibility. A 15 second total deadline covers
discovery, execution, fallback and body consumption. Caller cancellation stops
the request and prevents fallback. `timeoutMs` and `capabilityTtlMs` are positive
millisecond options. `forcePost: true` bypasses discovery entirely.

`onMetric` receives attempt method/status and final success/fallback/attempt
counts with elapsed milliseconds, never credentials, inputs or report data.
Elapsed time is cumulative from the start of the logical request. Final method
is the last transport selected. Observation failures do not alter report results.
An operator supplied collector may aggregate direct QUERY success, final success,
fallback frequency and latency; there is no automatic telemetry upload or
permanent metrics store. Discovery traffic is not counted as a report attempt.

### Verification and rollout

`npm test` includes client failure cases and application parity tests. The
integration test needs `php-cgi` on PATH as well as PHP CLI, Node and Python 3.
The CGI checks execute the actual public endpoint using QUERY, bounded raw input,
authentication and tenant config. They cover input failures, method exclusions,
disabled mode, permissions, revocation and tenant isolation.

The installed PHP development HTTP server currently rejects QUERY before PHP
runs. CGI checks establish application handling, not production web server
acceptance. The integration suite also runs the real client against the normal
development endpoint, exercising its actual unsupported method fallback on that
server. No request method rewrite is used to claim QUERY support.

Before a production canary, check the actual server, proxy and any WAF with a
disposable report credential. Roll out this adapter to one reporting consumer,
retain POST control traffic, and collect direct success and final success
separately. Suggested initial gates are zero result or isolation defects, at
least 99.5 percent direct QUERY success in its supported cohort, fallback no
higher than 0.5 percent and no p95 latency regression above 5 percent. Use a
fixed data snapshot for correctness and the same cache policy on both methods.
At least a week and a meaningful request sample are needed before a reliability
claim. No performance improvement or production compatibility is established by
the local tests. Existing manager reporting UI and its GET API are unchanged;
this is the scoped machine reporting pilot.

The public demo policy blocks integration routes by default. An owner can set
`demo_integration_reports: true` privately to admit authenticated summary
discovery and execution only. This does not permit demo managers to issue keys,
export reports or execute key commands. Summary still requires a privately
issued scoped integration key and its ordinary rate limits. On a host that
rejects native QUERY before PHP, also set `integration_query_enabled: false`
so discovery chooses POST rather than advertising an unusable transport.
