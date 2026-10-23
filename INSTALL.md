# Install dyws

Download **dyws.zip** from this repository, or clone the repository. The ZIP includes the pinned PHP dependencies and is ready to upload. A Git checkout needs `composer install --no-dev` first. Node.js is not required to run the website.

## Before opening the website

1. Extract the ZIP. Keep its directory structure: public_html, modules, server, plugins, vendor, examples and var.
2. Set your domain or subdomain document root to **dyws/public_html**. Keep the other folders outside the web root. Do not put the ZIP itself in a public directory.
3. Enable HTTPS and PHP 8.1 or newer with PDO SQLite, OpenSSL, curl and mbstring.
4. Give the PHP process write access to the private **var** folder. Temporarily give it write access to **public_html** and **public_html/setup** so the installer can remove itself. Use ownership or group permissions appropriate to your host, not world writable permissions.

For shared hosting where the document root cannot be changed, place the private folders in a sibling private installation directory. Copy only public_html's contents into the website directory. Create `public_html/api/bootstrap-path.php` that returns the absolute path of the private `server/bootstrap.php`:

```php
<?php
return '/home/example/private/dyws/server/bootstrap.php';
```

Keep server, modules, plugins, vendor, examples and var together in that private installation directory. The browser installer will use this adapter too.

## Browser setup

Open the website, or visit **/setup/** beneath its URL, such as `https://example.com/shop/setup/`.

1. Check the server requirements. Open **var/setup-key.txt** in your hosting file manager and copy the key into setup. The key is generated on the first setup visit and is never displayed publicly.
2. Enter the business name, full website URL, admin password and password confirmation. Choose an empty catalog or the Starlit Diner example. For a subfolder installation, include that subfolder in the website URL.
3. Select **Install dyws**. Setup creates the database, JSON configuration and catalog, then removes the setup directory. Open Admin and sign in with the password you chose.

There is no default administrator password and no default driver account. Add drivers in Admin. Payments remain in test mode. The empty catalog uses a plain storefront with your business name; choosing Starlit Diner retains the fictional demo website. Customize that host website separately or embed the reusable module in your own site.

If the server cannot remove an unexpected file in setup, installation remains locked and the completion page tells you to remove the remaining folder through the file manager. Reuploading setup does not unlock an installed site. Restore normal read only permissions on application code after installation. Keep var writable by PHP.

## Storage

- SQLite: orders, order events, payment records, sessions, GPS, drivers and administrator password hashes.
- Private JSON: overall site configuration, business settings, role labels, Google Maps settings, encrypted Stripe settings and product catalog.
- No default credentials, customer data, databases, private configuration or deployment adapters are included in the ZIP.

The new database is `var/orders.sqlite`. All passwords are hashed. JSON orders were not introduced because the existing ordering engine already stores orders transactionally in SQLite.

## Existing installations

Do not run setup or replace var. Back up code and private data before deploying an upgrade. Deploy the updated PHP modules, then run:

```sh
php server/migrate-accounts.php /absolute/private/var/config.json
```

This takes a consistent SQLite snapshot plus private JSON backups, imports driver accounts and the current admin password, and removes account records from the active JSON configuration. Legacy account overrides take precedence over original configuration values. Driver IDs, names, passwords, active status, assignments and existing sessions are preserved. Imports run once per tenant; stale JSON cannot revive or overwrite a migrated account. Backups remain private under `var/account-backups/`.

The account code also imports automatically on first access for compatibility, but the CLI is the recommended upgrade path because it snapshots the database and archives legacy files. An old release must not be restored on its own after account changes: restore its matching credentials and database backup too.

## Local development

```sh
composer install --no-dev
php -S 127.0.0.1:8097 -t public_html
```

Visit `http://127.0.0.1:8097/setup/`. Localhost is the only HTTP exception. Browser setup removes the checkout's setup directory; test installations should use a disposable clone or extracted ZIP. The tracked files can be restored from Git when needed for development, but existing config still blocks reinstalling.

`npm run setup` is a separate CLI demo fixture with generated credentials and a demo driver. It is intended for automated tests and local development, not merchant installation.

## Building the ZIP

```sh
composer install --no-dev
npm run build:zip
DYWS_INSTALL_ARCHIVE="$PWD/dyws.zip" python3 tests/installer.test.py
```

Stage new release files before building. The packager uses tracked source and Composer dependencies, excludes runtime data and deployment adapters, and adds a SHA256 file manifest. Commit the single root **dyws.zip** with the release.

## Reference

The flow follows MediaWiki's [browser installer](https://www.mediawiki.org/wiki/Manual:Config_script): check the environment, collect installation details, create persistent configuration, then refuse repeat setup. MediaWiki's [installation instructions](https://www.mediawiki.org/wiki/Manual:Installing_MediaWiki) also keep SQLite data outside the document root. dyws writes its private configuration directly and removes its installer automatically.

## Plugins

The install ZIP includes Google Maps and Stripe as active bundled plugins. Stripe checkout remains disabled until configured. After setup, open Admin → Plugins to manage activation and Settings to configure active plugins. Upload private plugins/ beside server and modules, and public_html/plugins/ with the website. Preserve both parts when using split shared hosting. See [Plugin documentation](docs/plugins.md) to install or develop additional plugins.
