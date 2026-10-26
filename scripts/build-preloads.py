#!/usr/bin/env python3
"""Resolve local module graphs ahead of time, so PHP can preload active code in parallel."""
import json,pathlib,posixpath,re,urllib.parse
root=pathlib.Path(__file__).resolve().parents[1];public=root/'public_html'
pattern=re.compile(r'''(?:\bfrom\s*|\bimport\s*)["']([^"']+)["']''')
def graph(entry):
 seen=set()
 def visit(url):
  if url in seen:return
  path=urllib.parse.urlsplit(url).path
  if not path.endswith('.js') or not (public/path).is_file():return
  seen.add(url)
  for target in pattern.findall((public/path).read_text()):
   if not target.startswith(('./','../')):continue
   resolved=posixpath.normpath(posixpath.join(posixpath.dirname(path),target))
   if not resolved.startswith('../'):visit(resolved)
 visit(entry);return sorted(seen)
pages={page:graph('platform/'+script+'.js?v=39') for page,script in [('driver','driver'),('tracking','tracking'),('orders','orders'),('reports','manager'),('catalog','admin'),('drivers','admin'),('settings','admin'),('password','admin'),('plugins','admin')]}
pages['tracking']=graph('platform/tracking.js?v=40')
pages['storefront']=graph('demo.js?v=40')
for page,module in {'catalog':'catalog-editor','drivers':'account-editor','password':'account-editor','settings':'general-settings','plugins':'plugin-admin'}.items():pages[page]=sorted(set(pages[page]+graph('dyws/'+module+'.js?v=39')))
plugins={}
for file in (root/'plugins').glob('*/plugin.json'):
 manifest=json.loads(file.read_text());entry=manifest.get('browserModule')
 if entry:
  plugins[manifest['id']]=graph(f"plugins/{manifest['id']}/{entry}?v={manifest['version']}")
  if manifest['id']=='datatables':plugins[manifest['id']]+=graph('plugins/datatables/vendor/dataTables.min.js')
def styles(entry):
 seen=set()
 def visit(url):
  path=urllib.parse.urlsplit(url).path
  if url in seen or not (public/path).is_file():return
  seen.add(url)
  for target in re.findall(r"@import\s+url\(['\"]?([^)'\"]+)", (public/path).read_text()):
   if target.startswith(('http:', 'https:', '//')):continue
   visit(posixpath.normpath(posixpath.join(posixpath.dirname(path),target)))
 visit(entry);return sorted(seen-{entry})
plugin_styles={}
for file in (root/'plugins').glob('*/plugin.json'):
 m=json.loads(file.read_text())
 if m.get('stylesheet'):plugin_styles[m['id']]=styles(f"plugins/{m['id']}/{m['stylesheet']}")
(public/'platform/preloads.json').write_text(json.dumps({'pages':pages,'plugins':plugins,'styles':plugin_styles},indent=2)+'\n')
print('Built module preload graphs.')
