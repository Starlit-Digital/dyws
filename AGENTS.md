# dyws project instructions

dyws is the platform. Starlit Diner is its fictional reference restaurant. Keep this repository separate from the original Cravings & Delight website. Preserve the existing diner visuals and accessibility preferences.

All current orders, payment records and driver routes are demonstrations. Do not describe test payment ledger actions as real charges or refunds. Do not claim native apps or production dispatch exist. Use fictional customer details for tests.

Serve only public_html. Keep server configuration, credentials, SQLite databases and backup data outside the web root and out of Git. Maintain tenant and driver assignment scope, authoritative server pricing, integer cent arithmetic, idempotency, status transitions and tracking token access. Do not add customer contact details to browser storage. Do not send or retain driver GPS outside an explicitly active delivery.

Run npm test for backend or cart changes. Document API contracts, reporting definitions and deployment changes. Preserve user edits and do not alter unrelated repositories.

Product data is generic. Keep the runtime catalog in private var/catalog.json, with seeds in examples. Do not overwrite a merchant catalog during deployment. Stripe integrations use the Composer SDK and hosted Checkout, test keys only for this demo. Never mark a Stripe order paid from a browser return or manager test action. Verify signatures, tenant, amount, currency and idempotency. Keep credentials encrypted outside public_html and never return them through an API. Run the catalog and Stripe tests with the existing suite.

Reusable presentation belongs in public_html/dyws. Prefix component classes and theme variables with dyws. Keep diner branding, hero, display controls and palette mapping in demo.css. Preserve the legacy element aliases, API routes, cart storage keys and tracking URLs during style refactors.

Reusable JavaScript belongs in public_html/dyws and PHP implementations in modules/dyws/php. Website scripts and server files are adapters or compatibility includes. Keep all package asset imports internal and inject website endpoints, DOM roots and map adapters. The homepage uses dyws PHP rendering functions; hydrate its existing panels without duplicating or replacing a host selected subset. Preserve escaped rendering and validate catalogs before producing HTML.

Orders and account credentials use SQLite. Overall settings and the catalog remain private JSON. The browser installer must never overwrite an existing installation, expose its ownership key, or ship runtime secrets. Build the single dyws.zip with scripts/build-release.py and test the extracted archive before publishing.

Plugins live in private plugins/<id> and public_html/plugins/<id>. Core owns discovery, lifecycle, authentication and hook dispatch; optional provider implementations belong in their plugin. Do not make core bootstrap require optional plugin code. Preserve saved plugin settings on deactivation. All plugin names and interfaces use plugin terminology. Package both halves in dyws.zip and test activation, deactivation, tenant scope and core operation without plugins.
