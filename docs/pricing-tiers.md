# Free and Pro reporting seam

November 4, 2026. This is a host configured entitlement boundary, with no billing or subscription provider attached. It is independent of Starlit's managed service offer names and prices.

Set `"pricing_tier": "free"` or `"pricing_tier": "pro"` in the installation's existing private config file. The config belongs to one tenant. Catalog, settings forms, browser flags and payment return URLs cannot grant Pro. Unknown tier values fail closed as Free. New installer setups explicitly start on Free. Existing installations with no tier retain Pro reporting for compatibility. Set the tier explicitly when assigning an installation to Free or Pro; absence is not evidence of a paid subscription.

`dyws\Entitlements::summary($config)` returns the tier and the `reports` capability. `requireReports($config)` rejects Free with HTTP 403, code `pro_required`. A future billing adapter can replace this trusted lookup with verified tenant entitlements. It must preserve the checks below. No upgrade button or checkout is wired to the seam.

## Distribution

Free includes the public kit and basic plugins for catalog, pickup, delivery and appointment booking. Pro covers advanced reporting and the private growth bundle, including analytics, order geography, add ons, loyalty and reorder reminders. Each private plugin also needs its own trusted tenant capability. Starlit can grant Pro separately or include it in managed hosting. The entitlement check is independent of how the installation is paid for.

## Covered surfaces

Pro owns aggregate business reports, charts and insights, CSV/text/PDF exports, report email and machine integration report commands. Free cannot call the core reports API or Order Reporting plugin APIs. Integration discovery omits report commands and their execution is rejected even for an existing report key. The private analytics and maps plugins use the same Pro guard and also require their own tenant capabilities. Driver profile responses omit computed tip summaries on Free. The underlying order and payment records remain intact, including individual receipts and assigned delivery summaries.

Customer complaints, driver blocks and dispatch warnings remain operational protections on both tiers. They are not sales analytics and cannot be bypassed by a downgrade. Customers can still view receipts and their own order records. Archiving has no entitlement requirement.

`GET /manager/entitlements` requires a manager and returns the current capability map. Server rendered Free report bootstrap omits all report results and reporting plugin payload. The shared Reports page renders a static block character wireframe with no working filters, exports, report calls, totals or merchant data. It labels the preview clearly and hides decorative blocks from assistive technology. A downgrade encountered in an open report page clears the existing report display.

`reportsPreviewHTML()` and `reports-preview.css` are brand neutral. `mountReportPanel({root,request,onError,allowFreePreview})` lets a host use its own Admin shell. Optional preview mode only removes access. It cannot grant access that the server denied. The Pro review demo can offer a Back to Pro reports button outside the preview. A genuinely Free installation has no such control.

## Deployment and qualification

Deploy the PHP guards, report page/controller, reporting integration changes, profile changes, styles and generated preloads together. Tier changes do not migrate or erase orders, payments, report source records or archive preferences. Existing keys remain stored but cannot access reports on Free. Report email still requires its own configured transport and policy; Pro is not proof that email is available or that a message reached an inbox.

The automated HTTP checks cover manager authentication, core and plugin report reads, export and email denial, integration command denial, profile tip summary omission, a Free server bootstrap without report data and restoration of access after returning to Pro. Browser verification of the host preview is recorded in the Little Caesars demo repository.
