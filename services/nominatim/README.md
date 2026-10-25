# DYWS address service

The shared service runs on the PayCal VPS reached from this Mac with
`ssh paycal-dev`, as `deploy`. The VPS address is `148.230.90.176`.
The owner explicitly confirmed this target on October 24, 2026.
`pct-hostinger` and `pct` both connect to the separate shared hosting account
at `191.101.13.124:65002`, as `u394197407`. Check these notes and
`ssh -G <alias>` before asking the owner for the connection again.

The endpoint is `https://geo.sltd.ca/search`. Namecheap BasicDNS
holds the `geo` A record. The existing `sltd.ca` website and mail records stay
on shared hosting. No OpenStreetMap account or API key is needed.

## Installation

The service uses Nominatim 5.3.3, PostgreSQL 17 and PostGIS 3.5 on Debian 13.
Python packages are isolated in `/srv/dyws-nominatim/venv` and recorded in
`requirements.lock`. The dedicated PostgreSQL cluster is `17/dyws`, uses
Unix sockets on port 5433, and has no TCP listener. PayCal nginx files and
application checkouts are not part of this deployment.

The initial source is the Geofabrik Alberta extract. Import style `full`
retains addresses and named places. Other provinces require additional data;
do not claim nationwide coverage. Canadian house number and postal code
coverage depends on the OpenStreetMap data. A result is a suggestion, not
proof that an address is deliverable.

The database owner is `dyws-nominatim`, limited to this database cluster.
The API runs as a separate `dyws-geocoder` operating system and PostgreSQL
user, with the read permissions granted during import. The API binds only
to `127.0.0.1:8086`. Nginx exposes only `/search` and `/status` over TLS.
Database, API and import processes have CPU and memory limits.

Source files map to these installation paths:

| Source | VPS destination |
| --- | --- |
| `project.env` | `/srv/dyws-nominatim/project/.env` |
| `postgresql.conf` | `/etc/postgresql/17/dyws/conf.d/dyws.conf` |
| `dyws-nominatim.service` | `/etc/systemd/system/dyws-nominatim.service` |
| `dyws-nominatim-update.service` | `/etc/systemd/system/dyws-nominatim-update.service` |
| `dyws-nominatim-update.timer` | `/etc/systemd/system/dyws-nominatim-update.timer` |
| `nginx-http.conf` | `/etc/nginx/conf.d/dyws-geocoder.conf` |
| `nginx-proxy.conf` | `/etc/nginx/snippets/dyws-geocoder-proxy.conf` |
| `nginx-site.conf` | `/etc/nginx/sites-available/dyws-geocoder.conf` |
| `renew-certificate.sh` | `/etc/letsencrypt/renewal-hooks/deploy/50-dyws-geocoder-nginx` |
| `autocomplete/*.py`, `autocomplete/schema.sql` | `/srv/dyws-nominatim/service/` |

Initial setup installs the Debian packages `postgresql-17`,
`postgresql-17-postgis-3`, `postgresql-17-postgis-3-scripts`, `osm2pgsql`,
`libicu-dev`, `python3-dev`, `python3-venv` and `pkg-config`. Prevent the
package installer from creating an unused `main` cluster on a fresh host.
Create the dedicated cluster with `pg_createcluster 17 dyws --port=5433`.
Never reuse an existing application database or overwrite a cluster.

Install the Python requirements as the dedicated account in its virtual
environment. Create the database roles before importing, with
`createuser -p 5433 --superuser dyws-nominatim` and
`createuser -p 5433 --no-superuser --no-createdb --no-createrole dyws-geocoder`,
running those commands as the PostgreSQL administrator. Only the importer
needs superuser access, and this cluster contains no PayCal databases.

Run the initial import as `dyws-nominatim`, from the project directory:

```sh
/srv/dyws-nominatim/venv/bin/nominatim import \
  --osm-file /srv/dyws-nominatim/data/alberta.osm.pbf \
  --threads 2 --osm2pgsql-cache 512
/srv/dyws-nominatim/venv/bin/nominatim admin --check-database
/srv/dyws-nominatim/venv/bin/nominatim replication --init
```

Install the autocomplete service files as root, mode 0644 inside a mode 0755
service directory. Before starting the API, run `service/refresh.py` with the
virtual environment Python as `dyws-nominatim`. It creates only the owned
supplementary schema. The API role receives SELECT access, never write access.

Start the API only after the import and database checks pass. Enable the
API service and update timer for restart recovery. The timer checks hourly
for Geofabrik's daily diffs, using a single bounded catch up process. A
missed run catches up later. TLS renewal uses Certbot's existing timer and
the scoped nginx reload hook. Always run `nginx -t` before reloading.

## Clients and privacy

Each DYWS installation authenticates to nginx using its own HTTP Basic
credential over HTTPS. Credentials are held by the PHP server, never sent
to the browser or stored in the repository. Initial credentials are created
on the VPS by `create-clients.py`, which refuses to overwrite an existing
credential set. The private source is
`/srv/dyws-nominatim/credentials/clients.json`, mode 0600 inside a 0700
directory. Nginx reads only password hashes from
`/etc/nginx/dyws-geocoder.htpasswd`.

Requests are limited to three per second per client, with a small burst,
and ten per second for the service as a whole. These are our capacity
controls, separate from the public Nominatim service's policy. Address
search traffic must not fall back to the public service automatically.
Autocomplete quality still depends on the underlying OpenStreetMap coverage.

Nginx access logs contain a client name, route, status and elapsed time,
without query strings, credentials, IP addresses or response contents.
Query logging and SQL error statement logging are disabled. Only address
search text should be sent by DYWS, excluding customer names, phone
numbers, apartment details, delivery notes and tracking data. The service
does not provide driver tracking or reverse geocoding.

Display `© OpenStreetMap contributors` with a link to
<https://www.openstreetmap.org/copyright> alongside search results. The
dataset remains subject to ODbL attribution and applicable share alike
terms, including when served by our own instance.

## Verification and recovery

`verify.py` tests real HTTPS, missing and incorrect credentials, method and
route restrictions, exact civic results, prefix and typo matches, house number
preservation and timing. It uses public civic
locations and a published business address. Run it on the shared hosting
server to measure the actual website to VPS path. Private test credentials
must remain outside the web root.

```sh
sudo python3 /home/deploy/dyws-nominatim-rollout/verify.py \
  --credentials /srv/dyws-nominatim/credentials/clients.json
systemctl status dyws-nominatim.service dyws-nominatim-update.timer
journalctl -u dyws-nominatim-update.service
```

For a code or configuration change, preserve the current files outside
web roots, check current digests, validate nginx and systemd configuration,
then reload only the relevant service. To roll back the service, disable
its timer, stop its API, unlink only the `dyws-geocoder.conf` enabled site,
validate and reload nginx. Preserve the data and credentials for recovery.
Do not stop or restart unrelated PostgreSQL clusters or PayCal services.
The OpenStreetMap database is rebuildable from the regional extract and
diffs. Preserve private client credentials and configuration separately;
never commit credentials, map extracts or database dumps.

## Prefix and typo matching

`autocomplete/dyws_autocomplete.py` wraps Nominatim's existing ASGI application.
It preserves usable native results, then tries up to three ranked candidates
when a search returns no usable matches. A supplementary PostgreSQL dictionary
uses B tree prefix, full text and trigram indexes. Street completion resolves
current street names by their OSM identifiers and city context, avoiding an old
street alias taking priority over the current road name.

House numbers and numeric street identifiers are never changed by typo matching.
When a house number is supplied, results with a different or absent house number
are removed. Query interpretation remains limited, so customers must check their
selection. Addresses missing from OpenStreetMap can always be entered manually.

Each worker allows two concurrent refinements with a two second deadline and a
150 ms SQL statement timeout. Refinement failure retains the native empty result.
No query or result cache is stored. Only public OSM names and address tokens are
copied into `dyws_autocomplete`; the stock Nominatim tables remain unchanged.

The update service refreshes the supplementary tables transactionally after
successful replication. A failed refresh retains the previous usable index and
marks the update unit failed. Inspect the unit journal, fix the cause, then run
the update service again. The last successful refresh time is in
`dyws_autocomplete.metadata`. A manual refresh can run as the importer:

```sh
sudo -u dyws-nominatim /srv/dyws-nominatim/venv/bin/python /srv/dyws-nominatim/service/refresh.py
python3 -m unittest discover -s services/nominatim/autocomplete -p 'test_*.py'
```

To revert only the matching enhancement, restore the API and update units from
`/var/backups/dyws-autocomplete-20261024`, run `systemctl daemon-reload`, and restart
only `dyws-nominatim.service`. The supplementary schema may remain unused. This
restores native Nominatim behavior, including its weaker house number matching.

## References

- [Nominatim installation](https://nominatim.org/release-docs/5.3/admin/Installation/)
- [Python deployment](https://nominatim.org/release-docs/5.3/admin/Deployment-Python/)
- [Database updates](https://nominatim.org/release-docs/5.3/admin/Update/)
- [Alberta data](https://download.geofabrik.de/north-america/canada/alberta.html)

## Initial deployment verification, October 24, 2026

The Alberta import completed in 26 minutes 53 seconds. Database integrity and
index checks passed. Optional Wikipedia importance data is not installed. The
first replication catch up succeeded, and both the API and hourly update timer
are enabled. Certbot renewal and its nginx reload hook passed a dry run.

The initial database uses about 6.2 GiB and the API about 128 MiB. PostgreSQL is
capped at 6 GiB, including cached pages. Actual shared hosting searches measured
254 ms median, with a 623 ms maximum across the six initial public address and
city queries. Existing PayCal nginx files matched their original digests.
See [the deployment receipt](../../docs/nominatim-deployment-20261024.json).

The completed enhancement has 26,434 dictionary tokens, 32,816 street names and
217,008 road segments, using 131 MiB including indexes. Nine deterministic
matching tests passed. All eleven live search cases passed from shared hosting,
with a median response of 232 ms and maximum of 597 ms. The update refresh hook
and API restart were verified. The published Eddie's house number is absent
from this extract; it now returns no suggestion instead of a different building.

## Statistics Canada civic address supplement

The service also searches Alberta civic addresses from the June 2026 National
Address Register, a free Statistics Canada dataset. Its separate `dyws_civic`
schema preserves source identity and does not modify Nominatim tables. The source
archive and its checksum stay on the VPS outside the web root. No resident or
business identities are imported. Unit identifiers are omitted and building
addresses are deduplicated. Where a building has conflicting postal codes, the
service leaves the postal code empty. Coordinates are representative points,
not a guarantee of a building entrance or delivery access.

Official source: https://www150.statcan.gc.ca/n1/pub/46-26-0002/462600022022001-eng.htm

Guide: https://www150.statcan.gc.ca/n1/pub/46-26-0002/462600022026001-eng.htm

Licence: https://www.statcan.gc.ca/en/terms-conditions/open-licence

The plugin displays the required adapted product acknowledgement. Do not use the
address reference data to identify residents or businesses. The search service
stores no customer queries or links between customers and reference records.

Refresh this supplement when Statistics Canada publishes a newer release.
Download the official archive to the private data directory, inspect its schema,
then run `import_civic.py` as `dyws-nominatim` with the virtual environment Python.
The importer stages and validates data before transactionally replacing the civic
index. OSM's hourly replication timer does not refresh this independent release.
Retain the previous archive and importer for recovery. Disabling civic lookup in
the ASGI wrapper restores the existing Nominatim search path.

```sh
sudo -u dyws-nominatim /srv/dyws-nominatim/venv/bin/python \
  /srv/dyws-nominatim/service/import_civic.py \
  /srv/dyws-nominatim/data/nar-202606.zip
```

The importer currently accepts the June 2026 schema and records its fixed source
URL and reference date. A newer edition requires updating those constants and
verifying its column definitions before importing. An import must retain at
least 90 percent of existing records and pass minimum province coverage checks.
Civic searches use exact house and numeric street identifiers with indexed word
prefixes and common street type aliases. The API has SELECT permission only.
If the civic index is unavailable, lookup continues through Nominatim.

### Civic import verified October 24, 2026

The June 2026 archive SHA256 is
`c87df8d39537b75146ab4b38b9b1ca1f820d72e0f74ee2b3722059851a564364`.
The import staged 1,899,432 address records and 1,241,933 locations, yielding
1,241,507 deduplicated addresses in 289 municipalities. Edmonton has 249,662
and Calgary 377,275 indexed addresses. The supplementary tables and indexes use
274 MiB. The importer ran for 79 seconds with about 41 MiB process memory;
PostgreSQL resource limits also remained in force. Read only API permissions and
unchanged PayCal nginx configuration digests were verified. The previously
unmatched address from the owner's screenshot now resolves through Eddie's and
hosted diner using the same short input. Public civic searches, source attribution,
unknown house number rejection and continued native Nominatim results passed.

This dataset also has omissions. It did not contain the published Eddie's pickup
address or the tested City Hall building addresses; Nominatim continues supplying
the latter. The service combines the available sources, not guaranteed complete
coverage. Existing public demo searches remain fictional and do not query either
dataset.

## Canadian locality name cache

`build-canadian-cities.py` scans all provincial and territorial address CSVs in
our official June 2026 NAR archive. It collects English and French census
subdivision names and mailing municipality names, then writes a sorted static
cache. This includes towns and rural mailing localities as well as cities.
The cache reflects that release, rather than asserting every current locality
has an address in NAR. Rebuild it with each new approved source edition.

DYWS uses the derived `public_html/dyws/canadian-cities.js` to split free text
addresses before a recognized city, preserving the remainder on line two.
Longer names are checked first, with word boundaries. Delivery addresses use
their structured city, province and postal fields directly. No customer address
is added to this public reference cache.

The October 24 build contains 11,595 distinct municipality and mailing locality
names from every province and territory in the June 2026 release. The generator
completed in about 147 seconds with a 9.3 MiB memory peak. Address formatting
checks comma boundaries before whitespace, so a street such as Edmonton Trail
is not confused with the city of Trail when a city follows a comma.
