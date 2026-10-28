# Customer navigation, accessibility and mobile review, October 27, 2026

Storefront and tracking links now reflect the verified customer session. Signed
out visitors see Sign in, leading to `account/sign-in/`. Signed in customers see
My account, leading to `account/`. The initial HTML uses the customer cookie, and
links refresh on focus, visibility changes and page return. Staff sessions and
fictional demo previews do not substitute for customer authentication.

The accessibility pass covered storefronts, account previews, sign in, customer
orders and empty tracking pages in all ten stores. Active merchant checkout,
review, tracking, order selection, driver reports and sign in were also checked.
Fixes include unique demo landmarks, a labelled demo gallery region, an order
tracking heading, keyboard skip links and a checkout dialog header that no longer
creates a duplicate banner landmark.

The mobile pass expanded small footer links, corrected native WebKit option
picker sizing and fixed the account preview at enlarged text sizes. The final
reproducible browser audit covers 100 page checks in Chromium and WebKit at
320, 390, 430, 768 and 844 CSS pixel widths, including portrait, landscape and
200% text. It reports zero automated accessibility violations and zero mobile
layout or small target findings. Keyboard skip links, visible focus and order
selection passed in both engines. The active merchant flow also passed with
mobile WebKit, including a landscape checkout.

Axe-core 4.14.0 checked WCAG A and AA tags through WCAG 2.2 plus best practices.
Six active merchant states also reported zero automated violations. The semantic
palette check sampled all 32 shades in each store, with the weakest measured
foreground and surface pair above 5.05:1. Image and gradient backgrounds produce
automated contrast items requiring visual review; representative light and dark
views were inspected. These browser and keyboard checks are not a formal
conformance certification or physical device and assistive technology study.

The full framework test suite passed. Normal merchant magic links, checkout
ownership, private history, driver reporting, blocking and sign out remain
functional. The demo plugin continues to disable account actions and email.

The audit can be repeated against isolated showcase fixtures with Playwright and
axe-core installed in developer tooling:

```sh
SHOWCASE_URL=http://127.0.0.1:8198 DYWS_AXE_SOURCE=/path/to/axe-core/axe.min.js node tests/customer-ui-audit.cjs
```

The script lives in the hosting repository and writes generated evidence under
`runtime/`. The machine deployment receipt is
`docs/customer-ui-deployment-20261027.json` in that repository. The release is
`/home/u394197407/domains/dyws.ca/private/releases/customer-ui-20261028T005711Z`.
Existing business records, catalogs and runtime configuration are preserved.
