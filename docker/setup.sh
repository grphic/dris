#!/usr/bin/env sh
# DRIS installeren met Docker: API-key en eerste station instellen, daarna bouwen en starten.
# Gebruik:  ./setup.sh   (opnieuw draaien kan altijd, bijv. voor een ander station of een nieuwe key)
set -eu
cd "$(dirname "$0")"

command -v docker >/dev/null 2>&1 || { echo "Docker is niet gevonden. Installeer eerst Docker (https://docs.docker.com/get-docker/)." >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "'docker compose' werkt niet. Installeer Docker Compose v2." >&2; exit 1; }

# De vragen draaien in een Node-container, als jouw gebruiker (zodat .env van jou blijft).
docker run --rm -it --user "$(id -u):$(id -g)" -v "$PWD":/work -w /work node:22-alpine node setup.mjs

echo
echo "Bouwen en starten (de eerste keer duurt dit een paar minuten)…"
docker compose up -d --build

PORT=$(sed -n 's/^DRIS_PORT=//p' .env)
echo
echo "Klaar! Open  http://localhost:${PORT:-8080}/"
echo "Op een ander apparaat in je netwerk: http://<ip-van-deze-computer>:${PORT:-8080}/"
echo "Instellingen: /dris/info/   ·   Stoppen: docker compose down"
