# Customer accounts and delivery identity deployment

Deployed October 27, 2026 to the ten fictional businesses at
[dyws.ca](https://dyws.ca/demos/). The account entry for each business is under
its own `account/` directory, including
[Starlit Diner](https://dyws.ca/demos/diner/account/).

The release includes verified email magic link accounts, private order history,
completed delivery reports, account wide driver blocks and permanent delivery
address IDs. Address identities include unit details and have separate customer
associations within each store. Existing orders retain their original receipt
addresses. Editing or forgetting device details does not rewrite order history
or remove account blocks.

All ten installations retain mandatory public demo restrictions. Real customer
registration and email sending remain disabled. The account pages state that
limit. Ordinary merchant installations still need an authorized sender and a
working host mail transport before customer sign in is enabled.

## Deployment and preservation

The demo request gate was verified before migration. Consistent SQLite snapshots
and private JSON backups were taken, and the previous source and public tree
were retained. The maintenance pause lasted 5.11 seconds. All existing columns
and records matched after migration. All ten databases passed integrity and
foreign key checks, with no missing delivery identities. Catalogs and runtime
settings were preserved. No real payments or device GPS were enabled.

Live verification found that the parent hosting configuration overrode PHP's
account page referrer header. A scoped account directory rule corrected it.
All account responses now return `no-store` and `no-referrer` on the host.

## Verification

- The complete `npm test` suite passed, including 146 JavaScript tests, 37 delivery
  identity checks, 154 customer HTTP checks and 47 remembered guest HTTP checks.
- The local browser workflow passed magic link sign in, checkout ownership,
  history, reports, blocks, staff warnings, unblocking and sign out. It covered
  320, 390 and 1280 pixel widths and enlarged text.
- All 150 hosted account entry and access checks passed across the ten demos.
- All 278 hosted showcase checks passed, including fictional ordering through
  delivery, retries, tenant isolation and public demo restrictions.
- The live account page displayed the demo restriction and had no browser
  warnings or errors.
- Hosted hashes matched all 240 changed public files and 111 private engine
  source files. No runtime credentials or database contents are in this report.

The owning site repository contains the machine readable deployment receipt,
private backup locations and the pinned framework commit. See
[deployment configuration](deployment.md#customer-accounts-and-email) for merchant
email setup and the database migration contract.
