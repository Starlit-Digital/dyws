# Accessibility center

A complete gear panel with reading, appearance, motion and focus preferences.

Import `index.js` as a module and include `../../shared/content.css` for the target adapter. Component CSS is loaded by the element from its own folder and `../../shared/ui.css`. No framework or build step is required.

```html
<script type="module" src="accessibility/components/preferences-center/index.js"></script>
<starlit-preferences-center target="#article" storage-key="my-project.reading.v1"></starlit-preferences-center>
```

The `target` attribute selects the content to adapt. Omit it to use the first `[data-a11y-content]` region. The optional `storage-key` isolates preferences by project. Components on the same target share a validated controller and stay in sync. IDs inside each component are isolated in its Shadow DOM.

Use `shared/content.css` and `[data-a11y-prose]` for scoped text styling. `starlit:a11y-change` is dispatched on the target after preference changes. The event includes `preferences`, `palette` and `reducedMotion`. App owned JavaScript motion should respond to this event.

Native labels, ranges, switches and select elements expose state directly. Dialog components use native modal focus containment, Escape, an explicit close button and focus return. No global letter shortcut is installed. Errors and polite status updates have separate regions.

Demos and reusable modules use external scripts and styles under a strict CSP. These files send no analytics and require no external service. Browser speech and fullscreen capabilities vary. Use `../../README.md` for the full scope and manual assistive technology checklist.

## Reference patterns

- https://evanswiki.com/
- https://docs.fluidproject.org/infusion/development/tutorial-userInterfaceOptions/WorkingWithUserInterfaceOptions
- https://github.com/Azkhar/accessibility-preference-widget
