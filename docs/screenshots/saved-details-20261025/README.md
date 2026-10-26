# Saved guest details verification, October 25, 2026

`checkout.jpg` shows the consent option, 180 day explanation, Terms and Conditions link, address label, default address and removal control in the local checkout. `terms.jpg` shows the explanatory page and its removal control.

The browser check used an isolated temporary SQLite database and fictional customer details. A demonstration order established a saved Home address. Returning to checkout restored the name, phone, street and unit. Custom labels and the consent choice survived Back navigation. A removed address remained absent when reopening an older checkout draft. The layout was also inspected at 390 × 844 pixels and the viewport was reset afterward.

No live order, charge, real customer detail, credential or tracking token is present in this screenshot. Automated API tests separately verify consent, cookie flags, business scope, sliding expiry, failed orders, idempotent retries, address removal, forgetting, expiry cleanup and public demo contact filtering.
