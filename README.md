# Starlit Ordering

A reusable restaurant ordering web component, demonstrated by the fictional Starlit Diner.

Demo: https://sltd.ca/preview/starlit-diner-7c2a91e6/?v=2

The project was cloned from the saved Cravings & Delight website, retaining its Git history. The diner demo replaces the restaurant content with 11 fictional menu items in four categories. Its address, phone and hours are fictional. The original website is preserved at https://github.com/Starlit-Digital/cravingsanddelight.ca .

## Run

`npm run serve`, then open http://localhost:8097 . There are no package dependencies or build steps. Run `npm test` for cart arithmetic, restoration, variant and catalog checks.

## Embed

Copy `public_html/ordering/` into the host website, excluding `demo.js` and the demonstration catalog if supplying your own. Load the component as a module:

```html
<script type="module" src="/ordering/component.js"></script>
<restaurant-ordering catalog="/menu.json" storage-key="my-restaurant-cart"></restaurant-ordering>
```

After `ordering-ready`, call `element.add(itemId, variantId)` from your menu buttons. `variantId` is required for items with variants. The component supplies the cart launcher, modal, quantity controls, saved cart and pickup checkout. The shadow root isolates styles. Override `--order-accent`, `--order-surface`, `--order-text` and `--order-muted` on the element to match a host website.

The JSON catalog contains restaurant, pickupAddress, currency, taxBasisPoints and categories. Item and variant prices are integer currency cents. See the demo catalog for the schema. Give every restaurant its own storage key. Only cart selections are saved locally. Customer checkout details are not persisted by the demo.

The host supplies `element.submitOrder = async order => ({id, demo: true})`. Without an adapter, checkout reports an error and preserves the cart. The supplied `demo.js` adapter creates a local test reference only. Events are `ordering-ready`, `cart-change`, and `order-complete`.

## Scope

This is a working frontend prototype, not a live order service. It does not transmit orders, collect payments, notify a kitchen or dispatch drivers. Production adapters must validate item IDs, availability, variants, prices, tax and totals on the server, enforce idempotency and return an accepted order reference. The browser totals are for display and cannot authorize a charge. Add restaurant operations, real fulfillment, payment and authenticated order management before using it for real customers. Current checkout copy deliberately identifies every order as a test.

## Validation

Four automated tests pass. Live browser checks covered adding items, tax totals, required checkout fields, successful test confirmation, variant restoration after reload, 390 pixel mobile cart layout and 48 pixel button targets. The demo has no external JavaScript dependencies.

## Earlier component search

Searched the available Starlit Digital, cshaiku and PayCal Technologies repository inventories and likely local GrandmaPizza, templates, archives and sltd source paths for cart and restaurant ordering code. No earlier reusable restaurant ordering component was found in those locations. Existing payment checkout code was not assumed to be a restaurant ordering system.
