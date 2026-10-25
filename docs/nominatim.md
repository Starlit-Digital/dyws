# Nominatim Address Lookup plugin

The optional `nominatim` plugin adds address suggestions to checkout and Business
Locations. It uses the installation owner's Nominatim service, initially containing
Alberta OpenStreetMap data. Search text is the only information sent to the service.
Customer names, phone numbers, apartment fields, notes and driver GPS are excluded.
Suggestions never submit orders, select addresses automatically, validate delivery
coverage or change prices. Customers choose a result and can edit the address.

Typing waits 650 milliseconds before searching our own service. Search and Enter
also work. Obsolete responses are discarded. The public OpenStreetMap Nominatim
service is not used, including when the private service is unavailable. Manual
address entry remains available if the plugin is disabled or lookup fails.

Our service adds bounded prefix completion and typo matching when ordinary
Nominatim searches have no usable result. For example, `Jasp, Edm` resolves to
Jasper Avenue NW in Edmonton, and `Edmotnon City Hall` resolves to Edmonton City
Hall. Numeric house and street identifiers are preserved. Missing house numbers
remain a manual entry case. Coverage and accuracy still depend on the imported
OpenStreetMap data, currently Alberta.

Selecting another suggestion replaces the address fields, including clearing
missing values. Apartment fields stay separate. A postal code is filled only
when the result includes a house number and a complete Canadian postal code;
a street or city result cannot supply a building's postal code.

## Configuration

Activate Nominatim Address Lookup in Plugins. A new installation has it inactive.
An owner provisions credentials from a private file on the server:

```sh
php plugins/nominatim/configure.php /private/path/config.json < /private/path/client.json
```

The input object has `endpoint`, `username` and `password`. Use an HTTPS `/search`
endpoint for an owned instance, such as `https://geo.sltd.ca/search`. Endpoint
changes require server access. Neither browser users nor managers can set an
upstream URL or read credentials through the API. Settings are encrypted with
AES 256 GCM, bound to the installation tenant and tracking secret, in a mode 0600
`nominatim-<tenant hash>.json` beside the private database. Preserve that file
and the installation secret together in private backups.

Managers can enable or disable suggestions without deleting credentials. Plugin
deactivation removes its routes and browser features while retaining settings.
Results carry an OpenStreetMap attribution link. Business address selections
mark the form as edited; the normal Business save action persists the changes.

## API

| Route | Access | Contract |
| --- | --- | --- |
| `GET /plugins/nominatim/config` | Public | enabled, demo, automatic and coverage only |
| `POST /plugins/nominatim/search` | Public | `{query}` of 4 to 240 characters, returns up to five normalized address suggestions |
| `GET /manager/plugins/nominatim/settings` | Manager | enabled, configured, demo, coverage and revision |
| `POST /manager/plugins/nominatim/settings` | Manager | `{enabled, revision}`, stale revision returns 409 |

Search accepts at most 1024 bytes and 40 requests per minute per client IP under
core rate limiting. The service also applies per installation and global limits.
Transport uses verified TLS, a two second connection timeout, a ten second total
timeout, no redirects, and a 256 KiB response cap. Credentials and upstream errors
are not returned to callers. Results contain `label`, `line1`, `city`, `region`,
`postalCode`, and `country`. Units stay in the customer's separate manual field.

The public diner demo uses a fixed fictional address with no network request.
Its installation policy allows only these lookup routes and still blocks settings
writes. Its mandatory lockdown plugin remains required.

## Checks

`npm test` includes settings encryption, tenant isolation, lifecycle and HTTP auth,
search limits, failure with successful manual checkout, demo isolation, debounce
and obsolete response suppression. Service setup, maintenance and actual network
verification are documented in [the operations guide](../services/nominatim/README.md).

The service also uses Alberta civic addresses from Statistics Canada's June 2026
National Address Register. Exact house numbers with street fragments can match
without a city, such as `123 Example Ave`. Ambiguous matches include the city so
the customer can choose. This supplements OpenStreetMap and retains separate
source attribution. The dataset remains a snapshot, not delivery validation.
