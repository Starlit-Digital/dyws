#!/usr/bin/env python3
"""Create initial server credentials on the VPS. Never print or commit them."""
import grp
import json
import os
from pathlib import Path
import secrets
import subprocess

os.umask(0o077)
directory = Path('/srv/dyws-nominatim/credentials')
directory.mkdir(mode=0o700, exist_ok=True)
destination = directory / 'clients.json'
auth_file = Path('/etc/nginx/dyws-geocoder.htpasswd')
if destination.exists() or auth_file.exists():
    raise SystemExit('Credentials already exist. Keep them or rotate individual clients deliberately.')
clients = {}
lines = []
for name in ('dyws', 'diner', 'eddies', 'verification'):
    password = secrets.token_urlsafe(36)
    password_hash = subprocess.check_output(
        ['openssl', 'passwd', '-6', '-stdin'], input=(password+'\n').encode()
    ).decode().strip()
    clients[name] = {'endpoint': 'https://geo.sltd.ca/search', 'username': name, 'password': password}
    lines.append(name+':'+password_hash)
destination.write_text(json.dumps(clients, indent=2)+'\n')
auth_file.write_text('\n'.join(lines)+'\n')
os.chown(auth_file, 0, grp.getgrnam('www-data').gr_gid)
os.chmod(auth_file, 0o640)
print('Created private client credentials and nginx password hashes.')
