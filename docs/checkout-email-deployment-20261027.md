# Checkout email deployment, October 27, 2026

Deployed to all ten stores in the [DYWS showcase](https://dyws.ca/demos/).
The release is `/home/u394197407/domains/dyws.ca/private/releases/checkout-email-20261027T213341Z`. The previous release remains available at
`/home/u394197407/domains/dyws.ca/private/releases/customer-accounts-20261027T194904Z`.

Checkout now includes optional contact email and an explicit magic link button.
Verified account email is filled automatically. Returning from email sign in
refreshes the account without losing the cart or checkout draft. Email appears
on final review and in manager order details. Existing custom layouts retain it.

Typed email is contact information only. It cannot claim an account, access
order history, create account address pairs or inherit driver blocks. A verified
session supplies the account identity; a conflicting email is rejected. The
existing remember details consent also covers email, with the same expiry and
Forget controls. Contacts stay out of browser storage, driver results and tracking.

The public demos use `jordan@example.test`, enforced independently by the server.
Real customer accounts and email sending remain disabled on those demos.
Merchant magic links require the existing private email configuration. Order
submission itself does not send email.

Validation:

* Complete `npm test` suite passed, including 21 new contact email checks.
* Browser verification passed for checkout magic link requests, verified session
  refresh, draft preservation, old custom layouts, review, account history,
  reports, driver blocking and unblocking, and sign out.
* Checkout was checked at 320, 390 and 1280 pixels. A long verified email now
  wraps on small screens. Account views also passed enlarged text checks.
* Live verification passed 308 showcase HTTP checks and 150 account HTTP checks.
  These include fictional email enforcement, manager visibility, driver and
  tracking privacy, tenant isolation and complete delivery flows.
* Live browser checkout, tracking reload and cart isolation passed with no errors.
* All ten databases passed integrity and foreign key checks. Existing records,
  catalogs and runtime settings were preserved through the additive migration.

The deployment changed 140 public files, followed by the email wrapping correction
in ten stylesheets. The checked private engine contains 111 files plus unchanged
dependencies. Demo maintenance lasted 5.31 seconds.
The consistent database and source backup is `/home/u394197407/domains/dyws.ca/private/backups/checkout-email-20261027T213341Z`.
The machine receipt is maintained in the hosting repository at
`docs/checkout-email-deployment-20261027.json`.
