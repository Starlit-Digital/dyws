#!/usr/bin/env python3
"""Verify the optional install ZIP's bytes, versions, source inventory and documentation assets."""
import hashlib,json,pathlib,re,stat,zipfile
root=pathlib.Path(__file__).resolve().parents[1]
version=(root/'VERSION').read_text().strip()
assert re.fullmatch(r'\d+\.\d+\.\d+',version),'Invalid VERSION'
for name in ['package.json','public_html/dyws/package.json']:
 assert json.loads((root/name).read_text())['version']==version,'Version mismatch: '+name
output=root/'dist'
archive=output/'dyws.zip'
assert (output/'SHA256SUMS').read_text()==hashlib.sha256(archive.read_bytes()).hexdigest()+'  dyws.zip\n','Archive checksum mismatch'
with zipfile.ZipFile(archive) as z:
 assert not z.testzip(),'Corrupt ZIP'
 names=z.namelist();assert len(names)==len(set(names)),'Duplicate ZIP entries'
 for info in z.infolist():
  p=pathlib.PurePosixPath(info.filename)
  assert not p.is_absolute() and '..' not in p.parts and p.parts[0]=='dyws','Unsafe ZIP path'
  assert not stat.S_ISLNK(info.external_attr>>16),'Symlink in ZIP'
  relative=p.relative_to('dyws').as_posix()
  assert not ('node_modules' in p.parts or '.git' in p.parts),'Development cache in ZIP'
  assert not (p.suffix in ['.sqlite','.db'] or p.name.startswith('.env') or p.name in ['bootstrap-path.php','LOCAL-ACCESS.txt','HOSTED-DEMO-ACCESS.txt','config.json','setup-key.txt','installed.lock']),'Runtime file in ZIP: '+relative
  assert not relative.startswith('var/') or relative=='var/.gitkeep','Private runtime data in ZIP'
 manifest=json.loads(z.read('dyws/MANIFEST.json'));assert manifest['version']==version
 assert set(names)=={'dyws/'+p for p in manifest['files']}|{'dyws/MANIFEST.json'},'Manifest coverage mismatch'
 for name,digest in manifest['files'].items():
  data=z.read('dyws/'+name);assert hashlib.sha256(data).hexdigest()==digest,'Manifest hash mismatch: '+name
  source=root/name
  assert source.is_file() and source.read_bytes()==data,'Archive differs from checkout: '+name
 for name in ['VERSION','CHANGELOG.md','modules/dyws/realtime/server.js','modules/dyws/realtime/package-lock.json','public_html/dyws/admin-refresh.js','vendor/autoload.php']:
  assert 'dyws/'+name in names,'Missing release component: '+name
 assert z.read('dyws/VERSION').decode().strip()==version
 for name in ['package.json','public_html/dyws/package.json']:
  assert json.loads(z.read('dyws/'+name))['version']==version
 readme=z.read('dyws/README.md').decode()
 images=re.findall(r'!\[[^\]]*\]\(([^)]+)\)',readme)
 assert len(images)>=12,'Screenshot gallery incomplete'
 for name in images:assert z.read('dyws/'+name).startswith(b'\xff\xd8\xff'),'Missing or invalid JPEG: '+name
 # Check local Markdown destinations, including the complete documentation guide.
 for link in re.findall(r'\]\(([^)]+)\)',readme):
  if '://' in link or link.startswith('#'):continue
  path=link.split('#',1)[0]
  assert (root/path).exists(),'Broken README link: '+path
print(f'Release {version}: checksum, {len(names)} archive entries, versions, private file exclusions and {len(images)} screenshots verified.')
