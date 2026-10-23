#!/usr/bin/env python3
"""Build the single install ZIP from tracked source plus locked Composer dependencies."""
import hashlib,json,pathlib,subprocess,zipfile
root=pathlib.Path(__file__).resolve().parents[1]
subprocess.run(['composer','validate','--no-check-publish'],cwd=root,check=True)
if not (root/'vendor/autoload.php').is_file():raise SystemExit('Run composer install --no-dev first.')
tracked=subprocess.check_output(['git','ls-files','-z'],cwd=root).decode().split('\0')
files={}
for name in tracked:
 if not name:continue
 if name.startswith(('public_html/','modules/dyws/php/','server/','examples/','docs/')) or name in ['README.md','INSTALL.md','composer.json','composer.lock','package.json']:
  if name=='public_html/api/bootstrap-path.php' or pathlib.Path(name).suffix in ['.sqlite','.db'] or '/node_modules/' in name:raise SystemExit('Refusing private/runtime file: '+name)
  path=root/name
  if path.is_symlink():raise SystemExit('Refusing source symlink: '+name)
  files[name]=path.read_bytes()
for path in (root/'vendor').rglob('*'):
 if path.is_symlink():raise SystemExit('Refusing dependency symlink: '+str(path))
 if path.is_file():files[path.relative_to(root).as_posix()]=path.read_bytes()
for needed in ['public_html/setup/index.php','modules/dyws/php/Installer.php','modules/dyws/php/accounts.sql','INSTALL.md']:
 if needed not in files:raise SystemExit('Stage release source before building: '+needed)
files['var/.gitkeep']=b''
manifest={'version':json.loads((root/'package.json').read_text())['version'],'files':{name:hashlib.sha256(data).hexdigest() for name,data in sorted(files.items())}}
files['MANIFEST.json']=(json.dumps(manifest,indent=2)+'\n').encode()
archive=root/'dyws.zip'
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for name,data in sorted(files.items()):
  entry=zipfile.ZipInfo('dyws/'+name,date_time=(2026,1,1,0,0,0));entry.compress_type=zipfile.ZIP_DEFLATED;entry.external_attr=0o100644<<16;z.writestr(entry,data)
with zipfile.ZipFile(archive) as z:
 if z.testzip():raise SystemExit('ZIP integrity check failed.')
print(f'{archive}: {len(files)} files, {archive.stat().st_size:,} bytes')
print('SHA256 '+hashlib.sha256(archive.read_bytes()).hexdigest())
