#!/usr/bin/env bash
# Zet de inhoud van dist/ op de web-LXC (CT 106, 192.168.80.20) via de Proxmox-host, onder /var/www/dris.
# Gebruik:  npm run build && ./scripts/deploy.sh
# Eenmalig vooraf: Caddy-config uit deploy/Caddyfile.dris + NS_API_KEY in de Caddy-service (zie die file).
set -euo pipefail
cd "$(dirname "$0")/.."

HOST=root@192.168.1.183
CT=106
WEBROOT=/var/www/dris

[ -f dist/index.html ] && [ -f dist/info/index.html ] || { echo "dist/ ontbreekt of is onvolledig: draai eerst  npm run build" >&2; exit 1; }

# Nieuwe map vullen, dan atomair omwisselen zodat de site nooit half is.
COPYFILE_DISABLE=1 tar --no-xattrs --no-mac-metadata -C dist --exclude .DS_Store -cz . \
  | ssh "$HOST" "export LC_ALL=C; pct exec $CT -- bash -c '
      set -e
      rm -rf $WEBROOT.new $WEBROOT.old
      mkdir -p $WEBROOT.new
      tar -xz -C $WEBROOT.new
      chmod -R u=rwX,go=rX $WEBROOT.new
      [ -d $WEBROOT ] && mv $WEBROOT $WEBROOT.old
      mv $WEBROOT.new $WEBROOT
      rm -rf $WEBROOT.old
      du -sh $WEBROOT'"

echo "Klaar: http://192.168.80.20/dris/  (instellingen: /dris/info/)"
