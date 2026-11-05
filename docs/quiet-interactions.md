# Quiet interaction feedback

The browser package now gives catalog rows, actionable order rows and controls
quiet feedback without changing layout or taking over native activation.
Transitions take 140ms. A successful cart change gives the affected catalog row
and basket launcher one 260ms inset highlight. Initial rendering, blocked adds
and item limits do not produce a success effect. Existing live status messages
remain the accessible confirmation.

`confirmed-interactions.js` exports `confirmInteraction(element)`. It dispatches
`ui:confirmed` with bubbling and composition enabled. One document listener
handles confirmed elements, including targets inside the ordering shadow root.
The helper is decorative and never changes cart data or application state.

`quiet-interactions.css` is imported by both `dyws.css` and `ordering.css`.
Motion variables inherit from the page preferences target into the shadow root.
Both the system setting and `data-sdou-a11y-motion="reduce"` suppress motion.
The deployed legacy `data-sda-motion="reduce"` signal is also supported.
Forced colors omits decorative success animation and retains native focus.

Validation on October 31, 2026: the complete framework suite passed. Chromium
and WebKit checks covered successful and blocked cart changes, mobile reflow,
keyboard focus, forced colors and reduced motion across the shadow boundary.
Public deployment evidence is in the sibling sltd.ca repository at
`docs/subtle-interactions-deployment-20261031.json`. No backend API, cart event
payload, pricing, checkout contract or runtime data changed.

The dyws.ca pinned engine working tree carries the same public source patch.
Its existing deployed namespace adaptations, per demo browser storage and
runtime paths were preserved. The deployment used file deltas rather than a
framework rebuild. Neither source repository was committed or pushed.

Final verification: Chromium and WebKit passed against the live sites, including
native focus, mobile reflow and both deployed motion preference adapters.
The sampled highlighted card and catalog paragraphs passed 4.5:1 across all
32 settled shades. These samples do not certify every control or page.
Public delivery passed 140 HTTPS checks, including 120 exact asset digests.
Final asset version: 20261031-subtle2. The original private before images remain
the rollback baseline; the motion adapter correction receipt is a child of the
same backup directory. No production account was mutated and no order submitted.
