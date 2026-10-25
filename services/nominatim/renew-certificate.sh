#!/bin/sh
set -eu
case " ${RENEWED_DOMAINS:-} " in
  *" geo.sltd.ca "*) /usr/sbin/nginx -t && /usr/bin/systemctl reload nginx ;;
esac
