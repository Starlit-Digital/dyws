# Reusable order flow

November 4, 2026. Extracted from the Little Caesars review demo after its full order flow audit. The merchant brand, assets, fonts, product copy, bag geometry, navigation, product panels, builder layout, demo credentials and public sample tracking endpoint remain in that private site repository.

## Browser behavior

`createOrderView({root,render,key})` in `public_html/dyws/order-view.js` accepts host owned markup. `update(value,{force})` skips identical data, defers updates while an input, select or editable field has focus, preserves disclosure state and restores focus to a matching enabled control. If the control disappeared, focus moves to the containing view. Give disclosures stable IDs or `data-dyws-disclosure` keys; ordinal matching is a fallback. `clear()` invalidates the render signature after sign out or host navigation.

`lockOrderControls(root,selector)` returns an unlock function. Use it in a `finally` block. It restores the original disabled state of connected controls and leaves new DOM controls with their current business rules. It does not grant an action that the server denied. `focusOrder(root,id)` can focus an existing card after a mutation; it never fetches or authorizes an order.

The Admin selected order refreshes independently from the summary table. An update to another order no longer redraws its detail. Driver actions share a mutation guard. Repeated identical reads do not accumulate event listeners or bypass the second confirmation for recording door collection. Completing a delivery remains disabled until its payment status allows completion. Failed requests preserve that guard.

The existing catalog editor already protects unsaved catalog and business settings drafts. Customer tracking already updates its panels incrementally and preserves receipt disclosure. Those implementations were retained rather than replaced by demo markup.

## Driver history

Authenticated `GET /driver/orders` adds `history` with up to 20 recent finished or cancelled assignments and `archived` with up to 200 archived summaries. Both lists use the session subject and tenant. Records are ordered by `updated_at` and ID. They include item and amount snapshots, status and time, but no customer contact, destination, instructions, private tokens, plugin payload or GPS.

Active assignments remain in `orders`. Driver history does not extend driver access to another driver's orders. The shared driver page renders summaries and Archive/Restore buttons. Hosts can render the same data in their existing style.

## Archive and restore

* `POST /manager/orders/{id}/archive`, body `{"archived":true}` or `false`.
* `POST /driver/orders/{id}/archive`, same body.
* `GET /manager/orders` returns ordinary orders. `?archived=1` returns the Admin archive. Each result carries `archived`.

Admin archiving is shared by managers within the tenant. Each driver's archive is separate. A driver can archive or restore only their current assignment. Only delivered, completed or cancelled orders can be archived. Attempting to archive an active order returns 409. Invalid boolean values return 422, missing authentication 401, incorrect roles 403 and assignments outside scope 404.

Archiving is a visibility preference. It does not delete or alter order totals, payment records, tracking, reports, status events or dispatch. `order_archives` stores the role preference and current status event checkpoint; `order_archive_edits` records changes. Identical retries do not create duplicate audit entries. A later status event invalidates the old preference, ensuring reopened work appears again. An eventual new completion does not silently revive an old archive.

Normal and archived manager lists are independently limited to 200 rows, matching the existing dashboard bound. Driver history is intentionally recent, not a full historical export. Merchant retention and deletion policy remains separate.

## Installation and verification

Deploy OrderArchive, DriverOrders, Entitlements, AdminAccounts, AdminData, PageData and API with their matching browser modules and generated preload graph. Both archive tables are additive and created on first use. Back up the private database first. No order data, runtime catalog, payment provider or credentials need replacement.

Tests cover role and tenant scope, privacy projection, repeat writes, archive independence, restoration, status reopening, unchanged tracking and payment data, selected detail refresh, draft/disclosure/focus preservation and disabled state recovery. Run `npm test`. The Little Caesars deployment is verified separately in its own repository; this source backport alone does not update any other hosted DYWS installation.
