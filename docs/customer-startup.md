# Customer first paint

Customer hosts include `dyws_render_customer_startup_head($prefix)` in the head
and `dyws_render_customer_startup_skeleton()` immediately inside the body. The
head helper loads the static scaffold, synchronous guard and accessibility
content styles. The scaffold is inactive without JavaScript.

The guard reveals the page after both readiness phases and pending styles in
the document and its shadow roots have settled. Customer preferences signal
`window.dywsCustomerStartup?.ready('theme')`. Existing storefront and tracking
`markReady()` signal content. `mountCustomerAccount()` now returns a `ready`
promise for its initial state, including demo and disabled sign in states; its
adapter signals content after that promise resolves. Later refreshes do not
reintroduce the page skeleton.

A five second fallback exposes server HTML if startup fails. It also clears
page busy state. The static skeleton has an accessible loading status and no
animation. Content is hidden from focus and assistive navigation until reveal.
No identity or contact information is stored by this controller.

The diner palette initializer reads the store scoped customer preferences before
paint, retaining the existing preference migration performed by the runtime.
The accessibility content stylesheet is reused rather than appended twice.
