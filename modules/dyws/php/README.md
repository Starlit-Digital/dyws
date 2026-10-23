# dyws PHP library

Include module.php from a private installation. Use dyws_load_catalog and echo dyws_render_menu, dyws_render_category or dyws_render_item to place catalog content in a host page. The returned markup uses dyws CSS classes and browser hydration hooks. Inclusion alone has no output or database side effects.

For order APIs, load the host Composer autoloader and call dyws_serve_api with an absolute private config path from a dedicated endpoint. The library contains catalog validation, SQLite storage/schema, API authorization and the plugin host. Sandbox Stripe services live in the bundled plugins/stripe directory. Existing StarlitGo service class names are retained for compatibility.

Keep this directory, catalog JSON, configuration, SQLite files and credentials outside the web root. Only the separate dyws browser package belongs in public assets. Configuration and HTTP contracts are documented in docs/dyws-module.md, docs/api.md and docs/deployment.md in the owning repository.
