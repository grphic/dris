#!/usr/bin/env sh
# DRIS bijwerken met een nieuw pakket (dris-docker.tar.gz). Je key en instellingen (.env) blijven staan.
# Gebruik:  ./update.sh pad/naar/dris-docker.tar.gz
#           ./update.sh            (zoekt het nieuwste pakket in deze map, de map erboven en Downloads)
set -eu
# Dit script overschrijft zichzelf tijdens het bijwerken: draai daarom vanaf een kopie.
if [ -z "${DRIS_UPDATE_DIR:-}" ]; then
  DRIS_UPDATE_DIR=$(cd "$(dirname "$0")" && pwd)
  # Pad naar het pakket vastleggen vóór we van map wisselen.
  if [ $# -gt 0 ]; then case "$1" in /*) ;; *) set -- "$(pwd)/$1" ;; esac; fi
  COPY=$(mktemp)
  cp "$0" "$COPY"
  DRIS_UPDATE_DIR="$DRIS_UPDATE_DIR" exec sh "$COPY" "$@"
fi
rm -f "$0" # the temporary copy; the shell keeps reading it
cd "$DRIS_UPDATE_DIR"
DOCKER_DIR=$(pwd)
ROOT=$(cd .. && pwd)

PKG="${1:-}"
if [ -z "$PKG" ]; then
  PKG=$(ls -t ./dris-docker*.tar.gz ../dris-docker*.tar.gz ../../dris-docker*.tar.gz "$HOME"/Downloads/dris-docker*.tar.gz 2>/dev/null | head -n 1 || true)
fi
if [ -z "$PKG" ] || [ ! -f "$PKG" ]; then
  echo "Geen pakket gevonden. Gebruik:  ./update.sh pad/naar/dris-docker.tar.gz" >&2
  exit 1
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
tar -xzf "$PKG" -C "$TMP"
NEW="$TMP/dris"
if [ ! -d "$NEW/src" ] || [ ! -f "$NEW/docker/compose.yaml" ]; then
  echo "$PKG lijkt geen DRIS-pakket." >&2
  exit 1
fi

echo "Pakket:         $PKG"
echo "Huidige versie: $(cat "$ROOT/VERSION" 2>/dev/null || echo onbekend)"
echo "Nieuwe versie:  $(cat "$NEW/VERSION" 2>/dev/null || echo onbekend)"
printf "Bijwerken? [J/n] "
read -r ok
case "$ok" in [nN]*) echo "Niets veranderd."; exit 0 ;; esac

# De code vervangen (zodat verwijderde bestanden ook echt weg zijn). De docker-map wordt alleen
# overschreven, niet leeggemaakt: daar staat .env met je key, en die zit nooit in een pakket.
for item in "$NEW"/*; do
  name=$(basename "$item")
  if [ "$name" = docker ]; then
    cp -R "$item"/. "$DOCKER_DIR"/
  else
    rm -rf "${ROOT:?}/$name"
    cp -R "$item" "$ROOT/$name"
  fi
done
chmod +x "$DOCKER_DIR"/*.sh

if [ ! -f "$DOCKER_DIR/.env" ]; then
  echo "Let op: er is nog geen .env. Draai eerst ./setup.sh." >&2
  exit 1
fi

echo
echo "Opnieuw bouwen en starten…"
docker compose up -d --build
docker image prune -f >/dev/null 2>&1 || true

PORT=$(sed -n 's/^DRIS_PORT=//p' .env)
echo
echo "Bijgewerkt naar versie $(cat "$ROOT/VERSION" 2>/dev/null || echo onbekend). Open  http://localhost:${PORT:-8080}/"
