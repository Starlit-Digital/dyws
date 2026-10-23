#!/usr/bin/env python3
"""Resolve local module graphs ahead of time, so PHP can preload active code in parallel."""
import json,pathlib,posixpath,re,urllib.parse
root=pathlib.Path(__file__).resolve().parents[1];public=root/'public_html'
pattern=re.compile(r'''(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["']([^"']+)["']''')
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
pages={page:graph('platform/'+script+'.js?v=37') for page,script in [('orders','orders'),('reports','manager'),('catalog','admin'),('drivers','admin'),('settings','admin'),('password','admin'),('plugins','admin')]}
plugins={}
for file in (root/'plugins').glob('*/plugin.json'):
 manifest=json.loads(file.read_text());entry=manifest.get('browserModule')
 if entry:plugins[manifest['id']]=graph(f"plugins/{manifest['id']}/{entry}?v={manifest['version']}")
(public/'platform/preloads.json').write_text(json.dumps({'pages':pages,'plugins':plugins},indent=2)+'\n')
print('Built module preload graphs.')
