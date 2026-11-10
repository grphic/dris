#!/usr/bin/env sh
# Maakt een pakketje om DRIS aan iemand anders te geven: de broncode + deze docker-map,
# zonder keys (.env, .env.local), node_modules, builds of de ASSETS-map.
# Gebruik:  ./docker/pack.sh   →  docker/dris-docker.tar.gz
set -eu
cd "$(dirname "$0")/.."
OUT=docker/dris-docker.tar.gz
# Versie = moment van inpakken; staat rechtsboven op /dris/info/ en wordt getoond door update.sh.
date '+%Y-%m-%d %H:%M' > VERSION
COPYFILE_DISABLE=1 tar -czf "$OUT.tmp" \
  --exclude '.env' --exclude '.env.*' --exclude '.DS_Store' --exclude '*.tar.gz' --exclude '*.tar.gz.tmp' \
  -s ',^,dris/,' \
  VERSION package.json package-lock.json tsconfig.json vite.config.ts index.html info public src docker
mv "$OUT.tmp" "$OUT"
# Controle: er mag geen key in zitten.
if tar -tzf "$OUT" | grep -E '(^|/)\.env' >/dev/null; then echo "FOUT: er zit een .env in het pakket" >&2; rm "$OUT"; exit 1; fi
echo "Gemaakt: $OUT ($(du -h "$OUT" | cut -f1))"
echo "Versie: $(cat VERSION)"
echo "Nieuwe installatie:  uitpakken, dan  cd dris/docker && ./setup.sh"
echo "Bijwerken:           cd dris/docker && ./update.sh pad/naar/dris-docker.tar.gz"
