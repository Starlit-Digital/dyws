# Order status stepper and history

The manager order detail includes a horizontal stage strip with explicit Beginning and End labels, numbered stages, clickable targets and Undo status and Redo status actions. It is a semantic ordered list, not a range input. Narrow views scroll the strip horizontally. Driver and customer hosts can render the same strip as read only.

Import `statusStepperHTML` and `statusStepperAction` from `public_html/dyws/order-status-stepper.js`. Include its package relative stylesheet, `order-status-stepper.css`. The module has no business identity or endpoint assumptions. Feed it a DYWS order with `statusControls` from manager order data. Without that capability object, it renders read only. Existing theme tokens supply surface, border and accent colors. Hosts own requests, refresh and error feedback.

## API

`GET /manager/orders/{id}/status-history` returns the current revision, allowed statuses, Undo and Redo availability, fulfillment specific steps and whether correction is editable. `GET /manager/orders` includes this object as each order's `statusControls`.

`POST /manager/orders/{id}/status-history` accepts `action` equal to `set`, `undo` or `redo`, plus the exact `revision`. The `set` action also requires `status`. The response contains `order` and `history`. Manager authorization and tenant ownership are required. A stale revision returns 409. Revisions cover status events, assignment, payment state and the correction cursor. Realtime invalidates the order and operators; the existing status validator and committed status action hooks run.

Normal core status changes become part of the undo sequence. Undo restores the previous change, Redo restores the next one. A new edit or a normal status transition after Undo creates a new branch and clears the abandoned redo sequence. Beginning and End refer to fulfillment stages, not the number of historical edits.

Correction currently applies only to demo payment orders. External and offline payment orders remain read only through this correction API and keep their existing normal controls. Completing an order still requires confirmed payment. Delivery stages require an active assigned driver and respect customer driver blocks. Customer cancellations, dispatch run membership and active location sharing block corrections. Stop location sharing or resolve the run through its normal workflow first.

Status correction does not capture, refund or rewind payments, alter prices or reopen a customer cancellation. A paid demo order can return to an earlier stage while staying paid. This is stated beside the controls. Production correction semantics for external payment providers require a separate operational contract.

The isolated `StatusHistory` service creates additive `order_status_history` and `order_status_edits` tables on first use. It preserves the original events and appends every correction, including its action, original and target status, actor and timestamp. It uses the existing Store transaction and does not replace the order database or schema file.

Tests cover normal transitions, undo, redo, branching, stale revisions, fulfillment limits, payment preservation, tenant and role boundaries, customer cancellation, assigned drivers, active location sharing and dispatch runs. `npm test` runs the component, backend and real HTTP tests.
