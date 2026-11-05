# Restaurant insights integration, November 5, 2026

The owner supplied ten restaurant delivery pain points and requested modular Pro analytics plus a Google maps area with six month history. Implemented privately in the existing sibling `dyws-growth` bundle as `growth-analytics` and `growth-maps`. The complete handoff, additive schema contracts, API and Simple versus Pro recommendation are in that bundle's `docs/restaurant-analytics-handoff-2026-11-05.md` and `docs/plugin-tiers-2026-11-05.md`.

Public framework changes are limited to explicit read only demo policy support under trusted `demo_growth_insights=true`. This does not bundle private plugins or enable capabilities by itself. Unknown plugins and writes remain denied. Existing pricing tiers and ordinary business records are preserved. No payment connector contracts changed.

The existing Reports template, aggregate service and shared Maps loader are reused. Private plugin endpoints additionally enforce trusted tenant capability and Pro tier. Ten restaurant demos received the new plugins; service demos were left intact. Google map preview is fictional with external API billing disabled. Provider money evidence remains unknown until separately imported. No actual settlement or bank payout is inferred.

Full framework and growth suites passed. New plugin integration and live HTTP/digest receipts are recorded in the owning repositories. Browser use was disabled, so rendered layout and keyboard verification are pending.
