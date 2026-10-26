# dyws PHP library

Include module.php from a private installation. Use dyws_load_catalog and echo dyws_render_menu, dyws_render_category or dyws_render_item to place catalog content in a host page. The returned markup uses dyws CSS classes and browser hydration hooks. Inclusion alone has no output or database side effects.

For order APIs, load the host Composer autoloader and call dyws_serve_api with an absolute private config path from a dedicated endpoint. The library contains catalog validation, SQLite storage/schema, API authorization and the plugin host. The public framework excludes Stripe. Separately installed payment plugins own their implementation and dependencies. Service classes use the lowercase `dyws` PHP namespace.

Keep this directory, catalog JSON, configuration, SQLite files and credentials outside the web root. Only the separate dyws browser package belongs in public assets. Configuration and HTTP contracts are documented in docs/dyws-module.md, docs/api.md and docs/deployment.md in the owning repository.
