# Separate PHP host example

This host places a category panel and a featured item using separate DYWS PHP calls. Both share the packaged cart. It contains no diner styling, map or imagery.

Arrange a temporary installation as follows:

* public/index.php, api.php and site.js: copy this example's three files.
* public/assets/dyws: copy public_html/dyws from the repository.
* private/dyws: copy modules/dyws/php from the repository.
* private/catalog.json: use the general store seed.
* private/config.json and a private SQLite file: configure the existing backend schema, pointing catalog to that same private catalog file. The repository setup CLI can initialize a test configuration using the general store seed as its second argument.
* private/vendor: the Composer dependencies, required when testing Stripe.

Serve only public. This example expects the goods category and tote product from examples/general-store/catalog.json. Its default product image is an external placeholder. For a minimal test without external assets, omit that optional image from your private copy.

Example setup from the repository, after creating the folders and copying the files:

```sh
php server/setup.php /absolute/example/private /absolute/repository/examples/general-store/catalog.json
php -S 127.0.0.1:8098 -t /absolute/example/public
```

Use fictional details only. The sample is a demonstration with its own order database. It is not a production installer.
