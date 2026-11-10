# DRIS met Docker

De vertrekschermen van het NS-perron, op je eigen scherm. Je hebt alleen **Docker** nodig (met `docker compose`).

## Installeren

```sh
cd dris/docker
./setup.sh
```

De setup:

1. vraagt je **NS API-key** en test hem (zo krijg je er een: account op <https://apiportal.ns.nl>, abonneer je bij *Products* op **Ns-App** en kopieer de *Primary key* uit je *Profile*);
2. laat je je **eerste station** kiezen, en een spoor (of het overzicht van alle vertrekken);
3. vraagt op welke **poort** het moet draaien (standaard 8080);
4. bouwt en start de container.

Daarna open je `http://localhost:8080/`. Op een ander apparaat in je netwerk (tv, tablet, oude laptop): `http://<ip-van-deze-computer>:8080/`.

## Gebruik

- `/` opent het station dat je bij de setup koos.
- `/dris/info/` is de instellingenpagina: station, sporen, één of twee treinen, overzicht, klok, kleuren, taal. Elke instelling zit in de link, dus je kunt per scherm een eigen link maken.
- Op het scherm: dubbelklik of `f` voor volledig scherm, `i` voor de instellingen.

## Beheer

| | |
|---|---|
| Stoppen | `docker compose down` |
| Starten | `docker compose up -d` |
| Bijwerken met een nieuw pakket | `./update.sh pad/naar/dris-docker.tar.gz` |
| Ander startstation of nieuwe key | `./setup.sh` opnieuw draaien |
| Logboek | `docker compose logs -f` |

De container start vanzelf weer na een herstart van de computer (`restart: unless-stopped`).

## Bijwerken

Krijg je een nieuw `dris-docker.tar.gz`? Pak het **niet** zelf uit, maar draai in deze map:

```sh
./update.sh ~/Downloads/dris-docker.tar.gz
```

Zonder pad zoekt hij zelf het nieuwste pakket (in deze map, de map erboven en Downloads). Het script laat de huidige en de nieuwe versie zien, vervangt de code, laat je key en startstation (`.env`) staan en bouwt en start de container opnieuw. Welke versie draait, zie je rechtsboven op `/dris/info/`.

## Over de key

De key staat alleen in `docker/.env` op jouw computer. Hij zit niet in de image en komt niet in de browser: de container voegt hem toe aan de aanvragen naar NS. Deel `.env` niet. De container laat alleen de NS-API's door die DRIS gebruikt, dus het is geen open doorgeefluik voor je key — maar zet hem niet zonder meer open op internet.

## Windows

Draai in PowerShell vanuit deze map:

```powershell
docker run --rm -it -v "${PWD}:/work" -w /work node:22-alpine node setup.mjs
docker compose up -d --build
```

## Let op

Het lettertype NS Sans en de logo's zijn van NS. Prima voor thuisgebruik, maar publiceer de image of de site niet openbaar.
