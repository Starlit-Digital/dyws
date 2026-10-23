# DYWS style package

DYWS means Do You Want Something. The reusable CSS lives in `public_html/dyws/`, independently of the fictional diner theme. Its package name is `@starlit-digital/dyws-styles`. It is private and has not been published to a registry.

## Entry points

Load `dyws/dyws.css` for the catalog, business admin, settings, driver console and inline tracking. It imports tokens and the catalog, admin and tracking modules. For a smaller page, load `tokens.css` plus only the needed module. The ordering element loads `dyws/ordering.css` inside its shadow root; that file imports its own tokens.

All classes use lowercase `dyws-`, including `dyws-catalog`, `dyws-category`, `dyws-product`, `dyws-item-stepper`, `dyws-ordering`, `dyws-shell` and `dyws-tracking-panel`. Every document selector is scoped to a DYWS root. The package sets no global body, root, button or typography rules. It has no reference to the diner palette variables, diner images or demo.css.

```html
<link rel="stylesheet" href="dyws/dyws.css">
<div class="dyws-catalog"><!-- Render categorized products here. --></div>
<dyws-ordering catalog="api/index.php?route=/catalog"></dyws-ordering>
<script type="module" src="ordering/component.js"></script>
```

The ordering JavaScript, catalog renderer and backend are still in their existing folders. This change extracts their presentation, not their runtime into new packages. Existing `starlit-ordering` and `restaurant-ordering` element names still work. Events, cart storage, API contracts and public tracking anchors are unchanged. The old CSS URLs are forwarding imports for updated integrations; legacy CSS class overrides should migrate to the DYWS names.

## Theme interface

Set public tokens on the host page or a containing element. Internal resolved values use `--dyws-color-*`. Defaults provide the existing dark appearance when no host theme is supplied.

| Public token | Purpose |
| --- | --- |
| --dyws-bg | Page and field background |
| --dyws-surface | Cards and dialogs |
| --dyws-raised | Steppers and secondary controls |
| --dyws-text | Primary text |
| --dyws-muted | Secondary text |
| --dyws-accent | Primary button background |
| --dyws-emphasis | Links, status text and focus outlines |
| --dyws-border | Field and dialog outlines |
| --dyws-button-text | Text on primary buttons |
| --dyws-font | Font shorthand, or inherit for host typography |
| --dyws-heading-font | Heading font family |

The diner maps its existing shade slider palette to these tokens in demo.css. That stylesheet retains only the host page, hero, footer, navigation, display preferences and theme mapping. Product cards, photos, steppers and the cart no longer depend on it. Photo layouts remain full width on mobile, with the category image on the left and under half the available width on desktop. Controls retain their 48px targets and manipulation touch behavior.

The existing admin and driver pages use `dyws-shell` now. Separate driver trip, admin, backend and installer components are future work, as requested; this extraction makes their style boundaries explicit without splitting those runtimes yet.
