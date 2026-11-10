# DRIS

De vertrekschermen van het NS-perron, op je eigen scherm (tv, tablet, oude laptop).

## Installeren met Portainer

Je hebt nodig: Portainer met een Docker-omgeving, en een (gratis) **NS API-key**:

1. Maak een account op <https://apiportal.ns.nl>
2. Ga naar **Products** en abonneer je op **Ns-App**
3. Open je **Profile** en kopieer de **Primary key**

Dan in Portainer:

1. **Stacks → Add stack**, geef hem de naam `dris`
2. Kies **Repository** als build method
3. Vul in:
   - **Repository URL:** `https://github.com/grphic/dris`
   - **Repository reference:** `refs/heads/main`
   - **Compose path:** `docker-compose.yml`
   - Is de repo privé? Zet **Authentication** aan, met je GitHub-gebruikersnaam en een *personal access token* (GitHub → Settings → Developer settings → Fine-grained tokens, alleen deze repo, *Contents: Read-only*) als wachtwoord.
4. Onder **Environment variables** (*Add an environment variable*):

   | Naam | Waarde | |
   |---|---|---|
   | `NS_API_KEY` | je Primary key | verplicht |
   | `DRIS_PORT` | bijv. `8080` | optioneel, standaard 8080 |
   | `DRIS_START` | bijv. `/dris/?station=UT&indeling=overview&weergave=screen` | optioneel: waar `/` naartoe gaat, standaard de instellingenpagina |

5. **Deploy the stack**. De eerste keer bouwt Portainer de image, dat duurt een paar minuten.

Open daarna `http://<ip-van-de-server>:8080/`.

### Bijwerken

Stacks → `dris` → **Pull and redeploy** (zet *Re-pull image and redeploy* aan). Je kunt ook **GitOps updates** aanzetten, dan werkt Portainer DRIS vanzelf bij als er iets nieuws in de repo staat.

## Gebruik

- `/` opent het startstation (`DRIS_START`), of anders de instellingen.
- `/dris/info/` is de instellingenpagina: station, sporen, één of twee treinen, overzicht, klok, kleuren, taal. Elke instelling zit in de link, dus je kunt per scherm een eigen link maken. Zo'n link (het deel vanaf `/dris/`) kun je ook als `DRIS_START` gebruiken.
- Op het scherm: dubbelklik of `f` voor volledig scherm, `i` voor de instellingen.

## Zonder Portainer

Zie [docker/README.md](docker/README.md): daar staat een setup-script dat de key en het eerste station vraagt.

## Over de key

De key staat alleen in de environment variables van de stack. Hij zit niet in de image en komt niet in de browser: de container voegt hem toe aan de aanvragen naar NS, en laat alleen de NS-API's door die DRIS gebruikt. Zet DRIS toch niet zonder meer open op internet.

## Let op

Het lettertype NS Sans en de logo's zijn van NS. Prima voor thuisgebruik, maar maak deze repo of de image niet openbaar.
