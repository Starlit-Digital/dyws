# dyws project instructions

dyws is the platform. Starlit Diner is its fictional reference restaurant. Preserve the existing diner visuals and accessibility preferences.

All current orders, payment records and driver routes are demonstrations. Do not describe test payment ledger actions as real charges or refunds. Do not claim native apps or production dispatch exist. Use fictional customer details for tests.

Serve only public_html. Keep server configuration, credentials, SQLite databases and backup data outside the web root and out of Git. Maintain tenant and driver assignment scope, authoritative server pricing, integer cent arithmetic, idempotency, status transitions and tracking token access. Do not add customer contact details to browser storage. Do not send or retain driver GPS outside an explicitly active delivery.

Run npm test for backend or cart changes. Document API contracts, reporting definitions and deployment changes. Preserve user edits and do not alter unrelated repositories.

Product data is generic. Keep the runtime catalog in private var/catalog.json, with seeds in examples. Do not overwrite a merchant catalog during deployment. DYWS is the public extensible framework and Starlit Diner is its independent fictional example. Stripe implementation, SDK and tests belong in the separate private dyws-stripe repository. Describe Stripe as a separately installed plugin, excluded from the kit. Starlit private additions and customer service agreements are separate from this framework. Preserve provider payment records and callback compatibility during upgrades. Verify tenant, amount, currency and idempotency; provider plugins own signature checks. Browser returns and manager test actions cannot confirm provider payments. Run the framework suite and the private plugin integration suite when changing shared payment contracts.

Reusable presentation belongs in public_html/dyws. Prefix component classes and theme variables with dyws. Keep diner branding, hero, display controls and palette mapping in demo.css. Use dyws based identifiers for PHP namespaces, environment variables, globals, browser storage and the ordering component. During development, update callers directly instead of retaining obsolete aliases or page URLs. Preserve stored business records.

Reusable JavaScript belongs in public_html/dyws and PHP implementations in modules/dyws/php. Website scripts and server files are adapters or compatibility includes. Keep all package asset imports internal and inject website endpoints, DOM roots and map adapters. The homepage uses dyws PHP rendering functions; hydrate its existing panels without duplicating or replacing a host selected subset. Preserve escaped rendering and validate catalogs before producing HTML.

Orders and account credentials use SQLite. Overall settings and the catalog remain private JSON. The browser installer must never overwrite an existing installation, expose its ownership key, or ship runtime secrets. Keep the complete source, assets, examples, tests, scripts and documentation in Git. The install ZIP is optional: build dist/dyws.zip with scripts/build-release.py and test the extracted archive before publishing it as a GitHub release asset. Never commit generated dist artifacts.

Plugins live in private plugins/<id> and public_html/plugins/<id>. Core owns discovery, lifecycle, authentication and hook dispatch; optional provider implementations belong in their plugin. Do not make core bootstrap require optional plugin code. Preserve saved plugin settings on deactivation. All plugin names and interfaces use plugin terminology. Package both halves of bundled public plugins in dyws.zip; exclude separately installed private plugins and their dependencies and test activation, deactivation, tenant scope and core operation without plugins.

Plugin validators are required checks and fail closed. Optional actions observe committed work and must not perform charging. Use the documented hook contracts and update their catalog and reference together. Keep authorization and authoritative pricing in core. Payment plugins may retain only host approved signed callbacks after deactivation. Do not expose plugin order data in public tracking by default.

## Address service hosting, confirmed October 24, 2026

The owner confirmed `paycal-dev` (`deploy@dev.paycal.app`, VPS `148.230.90.176`) as the Nominatim host. It shares the machine with PayCal production, so isolate service users, databases and resource limits. `pct-hostinger` and `pct` are the shared web hosting account at `191.101.13.124:65002`, user `u394197407`; they are not the VPS. Read `services/nominatim/README.md` and inspect `ssh -G` before asking the owner to repeat connection details. The address service hostname is `geo.sltd.ca`. Keep credentials outside repositories and web roots. Preserve the disabled PayCal development site and the existing production application.
