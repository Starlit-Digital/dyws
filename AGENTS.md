# Starlit Go project instructions

Starlit Go is the platform. Starlit Diner is its fictional reference restaurant. Keep this repository separate from the original Cravings & Delight website. Preserve the existing diner visuals and accessibility preferences.

All current orders, payment records and driver routes are demonstrations. Do not describe test payment ledger actions as real charges or refunds. Do not claim native apps or production dispatch exist. Use fictional customer details for tests.

Serve only public_html. Keep server configuration, credentials, SQLite databases and backup data outside the web root and out of Git. Maintain tenant and driver assignment scope, authoritative server pricing, integer cent arithmetic, idempotency, status transitions and tracking token access. Do not add customer contact details to browser storage. Do not send or retain driver GPS outside an explicitly active delivery.

Run npm test for backend or cart changes. Document API contracts, reporting definitions and deployment changes. Preserve user edits and do not alter unrelated repositories.

Product data is generic. Keep the runtime catalog in private var/catalog.json, with seeds in examples. Do not overwrite a merchant catalog during deployment. Stripe integrations use the Composer SDK and hosted Checkout, test keys only for this demo. Never mark a Stripe order paid from a browser return or manager test action. Verify signatures, tenant, amount, currency and idempotency. Keep credentials encrypted outside public_html and never return them through an API. Run the catalog and Stripe tests with the existing suite.

Reusable presentation belongs in public_html/dyws. Prefix component classes and theme variables with dyws. Keep diner branding, hero, display controls and palette mapping in demo.css. Preserve the legacy element aliases, API routes, cart storage keys and tracking URLs during style refactors.
