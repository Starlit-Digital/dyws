# Demo customer orders deployment, October 27, 2026

Published to all ten [DYWS demo stores](https://dyws.ca/demos/).
[Open the diner customer orders page](https://dyws.ca/demos/diner/account/orders/).

Every storefront header and tracking header has a My account link scoped to its
own store. The tracking link remains available when an order link is missing or
expired. My account links to the dedicated My orders page.

The orders page has selectable cards in a left rail and a detail panel containing
the receipt, destination, driver information and a driver control strip. The
layout stacks on phones. Merchant accounts use their authenticated order history
and the existing reporting and blocking APIs through the same view.

Public demos show fictional contact inputs, example orders and report fields.
Account actions, report submission, driver blocking and email controls are
disabled. Order selection and receipt disclosures remain available for browsing.
No customer API handlers are mounted in the preview. The existing server demo
allowlist independently denies account mutations, including direct requests.

The customer name is Demo Customer throughout checkout and demo previews, with
`demo.customer@example.test` as the fictional email. Earlier fictional contact
values are normalized in demo presentation. Their stored receipts and request
fingerprints remain intact so earlier order retries still work.

Validation:

* Full framework suite passed. Final frontend checks passed all 147 tests.
* Nine demo identity checks cover legacy retries, changed request rejection,
  tenant isolation and unchanged stored receipts.
* Demo browser checks cover disabled controls, selection between three orders,
  driver details, 320, 390 and 1280 pixel layouts, enlarged text, altered disabled
  attributes, pasted login links, eleven server denials and unchanged records.
* Merchant browser checks cover magic link sign in, checkout ownership, the new
  orders page, order history, reports, driver blocking, unblocking and sign out.
* Live verification passed 260 account HTTP checks and 308 showcase HTTP checks.
  Navigation browser checks passed across all ten stores without browser errors.
* Every database passed integrity and foreign key checks. Existing records,
  runtime settings and catalogs were preserved.

The account navigation update published 41 public files first. The customer
preview release then published 120 public files and a checked 111 file private
engine snapshot with unchanged dependencies. Demo maintenance lasted 5.15 seconds.

The final private release is
`/home/u394197407/domains/dyws.ca/private/releases/demo-orders-20261028T002347Z`.
The consistent backup is
`/home/u394197407/domains/dyws.ca/private/backups/demo-orders-20261028T002347Z`.
The hosting repository contains the machine receipt at
`docs/demo-customer-orders-deployment-20261027.json`.
