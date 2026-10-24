# Order Format

Order Format is an optional plugin for arranging the Cart, Customer details and Final review stages. Enable it in Admin → Plugins, then open Order forms. Existing order layouts remain the default until a saved template is assigned to a stage.

## Editor

Choose a stage and give the template a name. The left rail contains every supported field for that stage. Drag a field onto the two column canvas, or select it and click a cell. Fields already on the canvas can be moved; dropping onto a field of the same width swaps their positions. The right rail controls row, column, one or two column span, horizontal alignment and vertical alignment. Insert rows, remove empty rows and use Undo while editing. Layout and Preview modes have desktop and phone widths. Preview uses fictional sample values and never places an order.

Save template stores a draft. Under Stage templates, choose a saved template for each stage and select Apply stage templates. Saving changes to an already assigned template updates that stage on the next storefront page load. A template belongs to exactly one stage. Changing its stage resets its fields, and saving removes any old stage assignment. Duplicate makes an independent draft. Reload saved reads the latest server version; unsaved changes require an explicit discard before replacement. Concurrent edits return a conflict instead of overwriting another window.

Essential fields may be moved but cannot be removed. These include the order items and total, customer name and phone, fulfillment choice, delivery street input, final delivery fee and tax, and the core action buttons. Back and confirmation stay together across both columns. The final review also keeps Take more time. A custom review whose confirmation button is outside the visible area pauses the countdown. Core validation, authoritative prices, countdown cancellation and order idempotency still apply.

Delivery fields appear only for delivery. Unit, postal code, notes and pickup information can be omitted. Optional city, province or state, and country fields can be added to Customer details if the business needs them; they do not appear in the built in form. Phone numbers and postal codes retain the existing final review formatting. Other checkout plugins retain their own field area after the template.

## Fallback and storage

Choose Built in default for any stage to restore its existing layout. Disabling Order Format restores the existing formats for all stages on the next page load, while keeping saved templates and assignments. Missing files, failed layout loading, corrupt template settings or an invalid stage layout also use the built in formats. No order or customer record is rewritten. Already open storefronts retain the layout loaded with their page until reloaded.

Templates are stored outside the web root in `order-format-<tenant hash>.json` beside the database. The file contains layout metadata, never customer details. Public requests receive only assigned field positions, without draft names or revisions. Manager authentication is required to read or change drafts. Up to 30 templates and 30 rows per template are supported. Layouts accept only known field IDs and enumerated placement properties; HTML, scripts and custom CSS are not accepted.

The public diner demo permits exploring the editor and previewing layouts, with saving and assignments locked by Installation Lockdown. The private diner installation supports saving and assignment normally. Only the installation owner can activate the plugin in the public demo.

See [API contracts](api.md), [plugin capabilities](plugin-hooks.md) and [deployment](deployment.md).
