#!/usr/bin/env python3
"""Build an optional install ZIP in dist/ from tracked source plus locked Composer dependencies."""
import hashlib,json,pathlib,subprocess,zipfile
root=pathlib.Path(__file__).resolve().parents[1]
version=(root/'VERSION').read_text().strip()
for package in ['package.json','public_html/dyws/package.json']:
 if json.loads((root/package).read_text())['version']!=version:raise SystemExit('Version mismatch: '+package)
subprocess.run(['python3','scripts/build-preloads.py','--kit'],cwd=root,check=True)
subprocess.run(['composer','validate','--no-check-publish'],cwd=root,check=True)
if not (root/'vendor/autoload.php').is_file():raise SystemExit('Run composer install --no-dev first.')
tracked=subprocess.check_output(['git','ls-files','-z'],cwd=root).decode().split('\0')
files={}
for name in tracked:
 if not name:continue
 if name.startswith(('public_html/','modules/dyws/php/','modules/dyws/realtime/','server/','plugins/','examples/','docs/','services/nominatim/','firmware/order-printer/')) or name in ['README.md','INSTALL.md','VERSION','CHANGELOG.md','composer.json','composer.lock','package.json']:
  if name=='public_html/api/bootstrap-path.php' or pathlib.Path(name).suffix in ['.sqlite','.db'] or '/node_modules/' in name:raise SystemExit('Refusing private/runtime file: '+name)
  if name.startswith(('plugins/stripe/','public_html/plugins/stripe/')) or name in ['server/StripeSettings.php','server/StripePayments.php','modules/dyws/php/StripeSettings.php','modules/dyws/php/StripePayments.php','public_html/dyws/stripe-editor.js','public_html/dyws/settings.js','public_html/platform/settings.js']:raise SystemExit('Private Stripe plugin must not be tracked in the kit: '+name)
  path=root/name
  if path.is_symlink():raise SystemExit('Refusing source symlink: '+name)
  files[name]=path.read_bytes()
if (root/'vendor/stripe').exists():raise SystemExit('Remove stale Stripe SDK dependencies with composer install before building the kit.')
for path in (root/'vendor').rglob('*'):
 if path.is_symlink():raise SystemExit('Refusing dependency symlink: '+str(path))
 if path.is_file():files[path.relative_to(root).as_posix()]=path.read_bytes()
for needed in ['modules/dyws/php/DeliveryAddresses.php','modules/dyws/php/delivery-addresses.sql','modules/dyws/php/CustomerAccounts.php','modules/dyws/php/CustomerDrivers.php','modules/dyws/php/customers.sql','public_html/account/page.php','public_html/account/.htaccess','public_html/account/account.js','public_html/dyws/customer-account.js','public_html/dyws/customer-account.css','public_html/dyws/customer-order.js','public_html/dyws/customer-reports.js','server/cleanup-customer-accounts.php','VERSION','CHANGELOG.md','modules/dyws/realtime/server.js','modules/dyws/realtime/package-lock.json','public_html/dyws/admin-refresh.js','modules/dyws/php/Features.php','public_html/dyws/catalog-data.js','modules/dyws/php/PageData.php','public_html/dyws/tracking-handoff.js','public_html/platform/preloads.json','modules/dyws/php/AdminData.php','public_html/dyws/diagnostics.js','public_html/admin/page.php','public_html/auth/page.php','modules/dyws/php/AdminSession.php','public_html/home.php','public_html/orders/page.php','public_html/api/endpoint.php','server/router.php','public_html/setup/install.php','modules/dyws/php/Installer.php','modules/dyws/php/accounts.sql','modules/dyws/php/hooks.json','plugins/google-maps/plugin.json','public_html/plugins/google-maps/index.js','plugins/order-reporting/plugin.json','public_html/plugins/order-reporting/index.js','plugins/datatables/plugin.json','public_html/plugins/datatables/vendor/dataTables.min.js','plugins/order-format/plugin.json','plugins/order-format/plugin.php','plugins/order-format/Templates.php','plugins/order-format/schema.json','public_html/plugins/order-format/index.js','public_html/plugins/order-format/editor.php','public_html/plugins/order-format/editor.js','public_html/plugins/order-format/editor.css','public_html/plugins/order-format/model.js','public_html/dyws/order-layout.js','INSTALL.md']:
 if needed not in files:raise SystemExit('Stage release source before building: '+needed)
for provider in ['square','paypal','helcim','clover','moneris','authorize-net']:
 for part in ['plugins/'+provider+'/plugin.php','plugins/'+provider+'/Connector.php','plugins/'+provider+'/connector.json','plugins/'+provider+'/plugin.json','public_html/plugins/'+provider+'/index.js']:
  if part not in files:raise SystemExit('Stage release source before building: '+part)
for part in ['modules/dyws/php/Payments/Connector.php','modules/dyws/php/Payments/register.php','public_html/dyws/payment-connector-settings.js','public_html/dyws/plugin-types.js','public_html/dyws/plugin-edit.js','public_html/plugins/edit.php']:
 if part not in files:raise SystemExit('Stage release source before building: '+part)
for part in ['plugins/nominatim/plugin.json','plugins/nominatim/plugin.php','plugins/nominatim/AddressLookup.php','plugins/nominatim/configure.php','public_html/plugins/nominatim/index.js','public_html/plugins/nominatim/search.js','public_html/plugins/nominatim/lookup.css','docs/nominatim.md']:
 if part not in files:raise SystemExit('Stage release source before building: '+part)
for part in ['plugins/order-printer/plugin.json','plugins/order-printer/plugin.php','plugins/order-printer/PrinterService.php','plugins/order-printer/schema.sql','public_html/plugins/order-printer/index.js','public_html/plugins/order-printer/printer.css','docs/order-printer.md','firmware/order-printer/README.md','firmware/order-printer/DywsPrinter/DywsPrinter.ino']:
 if part not in files:raise SystemExit('Stage release source before building: '+part)
for part in ['modules/dyws/php/LocalTime.php','plugins/catalog/plugin.php','plugins/catalog/Pricing.php','plugins/pickup/Pickup.php','plugins/delivery/Runs.php','plugins/booking/Booking.php','public_html/plugins/booking/storefront.js','public_html/plugins/booking/page.js','public_html/plugins/booking/index.js','public_html/plugins/pickup/index.js','public_html/plugins/pickup/pickup.js','docs/business-capability-plugins.md']:
 if part not in files:raise SystemExit('Stage release source before building: '+part)
files['var/.gitkeep']=b''
manifest={'version':version,'files':{name:hashlib.sha256(data).hexdigest() for name,data in sorted(files.items())}}
files['MANIFEST.json']=(json.dumps(manifest,indent=2)+'\n').encode()
output=root/'dist'
output.mkdir(exist_ok=True)
archive=output/'dyws.zip'
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for name,data in sorted(files.items()):
  entry=zipfile.ZipInfo('dyws/'+name,date_time=(2026,1,1,0,0,0));entry.compress_type=zipfile.ZIP_DEFLATED;entry.external_attr=0o100644<<16;z.writestr(entry,data)
with zipfile.ZipFile(archive) as z:
 if z.testzip():raise SystemExit('ZIP integrity check failed.')
print(f'{archive}: {len(files)} files, {archive.stat().st_size:,} bytes')
digest=hashlib.sha256(archive.read_bytes()).hexdigest()
(output/'SHA256SUMS').write_text(digest+'  dyws.zip\n')
print('SHA256 '+digest)
