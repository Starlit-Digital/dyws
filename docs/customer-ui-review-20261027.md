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


## Consistent customer headers and preferences

All customer pages use the same header: store identity on the left, then the
accessibility gear and customer control on the right. A signed out customer sees
Sign in. A verified customer sees a native My account disclosure containing
My orders and Sign out. Escape closes the disclosure and returns focus, outside
click closes it, and only one account disclosure opens at a time. Sign out uses
the authenticated customer endpoint and clears private account content before
redirecting to sign in. Session changes in another tab refresh the header.

Demo account and orders pages expose the fictional preview dropdown. My orders
navigates normally, while Sign out remains disabled. Demo storefront, tracking
and sign in pages retain Sign in. The plugin denies account mutations even if
a visitor changes disabled controls in developer tools.

Customer pages now share the existing Starlit preferences center. Its source is
vendored under public_html/dyws/accessibility so standalone DYWS installations
work without showcase files. The adapter uses a stable store scoped preference
key across storefront, tracking, account, orders and sign in. Existing validated
showcase and diner display preferences migrate on first use. Browser storage
contains accessibility preferences only. Diner palette mapping remains intact.
Local adaptations include presentational dialog headers, native select sizing
and explicit order control foreground colors for WebKit.

The header follow up passed the framework suite and merchant browser flow,
including magic link access, private order history, driver report and block,
unblock and header sign out. The demo browser check passed with zero customer
API calls and eleven server guard checks. A further 100 page header check in
Chromium and WebKit verified preference persistence, menu keyboard behavior,
disabled demo actions and responsive controls. The 100 page accessibility and
mobile audit reports zero automated violations and zero mobile findings. The
open settings dialog also reports zero violations in both engines. Short
landscape dialogs scroll their header and footer so neither covers settings.

The My account disclosure also links Account details to `account/`, before
My orders and Sign out. Both server rendered and refreshed customer menus use
the same destination, including the guarded fictional account preview.
