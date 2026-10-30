# Shared host QUERY investigation and deployment

29 October 2026 in Edmonton, verified 30 October UTC.

## Outcome

The diner reporting pilot is deployed at `https://dyws.ca/demos/diner/api/`.
Native HTTP QUERY is **not enabled** at the public server boundary. LiteSpeed
returns its own HTML 400 before PHP. Live discovery therefore selects POST,
which works through the reporting client. QUERY application handling is
installed for activation after the provider fixes method admission. No hidden
method conversion is presented as native QUERY support.

## Confirmed host behavior

The SSH account is a shared hosting user. Web responses identify LiteSpeed and
PHP 8.3.36. Default CLI PHP is 8.1, so staged code was linted with the installed
PHP 8.3 binary. SSH Python is 3.6 and lacks SQLite's backup helper; the consistent
backup used PHP SQLite3's backup API. Early preparation errors stopped before
cutover and did not change the live installation.

An isolated PHP probe returned a marker proving application execution. GET and
JSON POST reached it with the correct method and body length. Valid QUERY failed
with HTML 400 over HTTP/1.1 and HTTP/2. Direct origin HTTPS using the same hostname
and certificate also failed. A scoped custom 400 error document did not execute.
This establishes rejection before our PHP handler and local error handling.
The temporary probe and its `.htaccess` were removed. Existing site `.htaccess`
files were not changed.

The root `/api/` is a legacy redirect. Use the exact diner endpoint above; the
credential carrying client deliberately refuses redirects.

[LiteSpeed's documentation](https://docs.litespeedtech.com/lsws/cp/cpanel/400-error/)
describes server generated 400 responses. The vendor's public
[OpenLiteSpeed method parser](https://github.com/litespeedtech/openlitespeed/blob/master/src/http/httpmethod.cpp)
illustrates fixed method recognition without QUERY in the inspected source.
That source is contextual evidence, not proof of the proprietary binary or
version running on this host. The actual probes establish the observed behavior.

## Scoped deployment

Only the diner API selects this isolated private release:

```text
/home/u394197407/domains/dyws.ca/private/releases/query-report-pilot-20261030T005826Z
```

The previous shared release is retained and unmodified. The new copy adds the
integration service, API handling, additive schema, report client, CLI,
documentation and a scoped demo policy opt in. The reusable report module is
also deployed under the diner's public `dyws/` directory. Other demo bootstrap
pointers were not changed.

The private diner config contains these two additions:

```json
{"integration_query_enabled":false,"demo_integration_reports":true}
```

Other config values were compared and preserved. The demo policy still blocks
public manager key issuance, key commands and machine report export. The owner
opt in admits only summary discovery and execution, which require a separately
issued scoped integration bearer key. Ordinary public demo credentials do not
grant integration access. No permanent service key was created.

## Completed verification

* Full `npm test` passed: 173 JavaScript tests, including a new fixture checking
  22 demo admission cases, plus all PHP and Python suites. Integration API tests
  passed 109 checks. The 22 dedicated report client tests remain included.
* Ten public authenticated or denied API checks passed. These covered malformed
  dates, unknown input, wrong content type, missing authentication, locked key
  commands and locked export. The reporting client selected POST from discovery
  and returned the same aggregate as the direct POST call.
* The temporary report scoped verification key was revoked. A subsequent public
  request confirmed rejection, and no active verification keys remain.
* Public client bytes and all seven scoped deployed file hashes match source.
  Database integrity is `ok`; counts of orders, payments and payment attempts
  were unchanged across deployment. Other config was preserved.
* Fourteen public smoke checks passed, covering the main site, diner page, diner
  admin page and all eleven current demo health endpoints.

The [sanitized evidence](http-query-shared-host-20261029.json) contains probe
results, checks, source hashes and backup locations. No performance improvement
has been established. POST is selected directly on this known unsupported host;
the client does not downgrade arbitrary HTTP 400 errors.

## Backup and rollback

```text
/home/u394197407/domains/dyws.ca/private/deploy-backups/query-report-pilot-20261030T005826Z
```

The private backup holds original config, the original public bootstrap pointer,
old diner bootstrap, consistent `cutover.sqlite` and deployment receipt. Restore
the saved pointer for code rollback. Remove just the two pilot config additions
while preserving later unrelated edits. Remove the newly added public module
only if rolling back the client too. Leave additive tables and revoked audit
records in place. Do not restore the database snapshot as a routine code rollback,
since that could discard subsequent business records.

## Provider action needed

The shared account cannot change the front server's method parser or restart
the provider's service. The following support request is ready but has not been
sent:

> Please enable native HTTP QUERY, RFC 10008, for dyws.ca on the shared LiteSpeed
> service. Valid QUERY requests currently return server HTML 400 before PHP over
> HTTP/1.1 and HTTP/2, including direct origin HTTPS. GET and JSON POST reach PHP
> correctly. An isolated PHP marker and scoped ErrorDocument confirmed QUERY does
> not reach our application. Please allow QUERY to reach `/demos/diner/api/` with
> its JSON body and REQUEST_METHOD preserved, retaining authentication, body
> limits and WAF protections. We are not asking for a generic method override or
> weakened security rules. Please identify the running LiteSpeed version and
> whether admission requires configuration or an updated build.

After the provider change, repeat an isolated method and body probe. Anonymous
QUERY to the report endpoint should reach DYWS and return JSON 401 instead of
HTML 400. With application QUERY disabled, a valid scoped key should receive the
application's 405 with `Allow: POST`. Only then enable `integration_query_enabled`
and verify QUERY/POST parity, input rejection, revocation, rate limits and client
selection using a temporary key. Revoke it afterward. Retain POST permanently.
HTTP/3 and browser CORS were not verified by this investigation.
