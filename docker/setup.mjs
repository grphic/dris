// DRIS setup: vraagt de NS API-key, test hem, laat je een eerste station (en spoor) kiezen en schrijft .env.
// Draait in een Node-container via setup.sh, dus je hebt alleen Docker nodig.
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'

const ENV = '.env'
const NS = 'https://gateway.apiportal.ns.nl'

const bold = (s) => `\x1b[1m${s}\x1b[0m`
const dim = (s) => `\x1b[2m${s}\x1b[0m`
const yellow = (s) => `\x1b[33m${s}\x1b[0m`
const red = (s) => `\x1b[31m${s}\x1b[0m`

const rl = createInterface({ input: process.stdin, output: process.stdout })
let muted = false
rl._writeToOutput = (s) => {
  if (!muted) rl.output.write(s)
  else if (s.includes('\n')) rl.output.write('\n')
}
const ask = (q) => new Promise((done) => rl.question(q, (a) => done(a.trim())))
async function askSecret(q) {
  process.stdout.write(q)
  muted = true
  const a = await ask('')
  muted = false
  return a
}

function readEnv() {
  if (!existsSync(ENV)) return {}
  return Object.fromEntries(
    readFileSync(ENV, 'utf8')
      .split('\n')
      .map((l) => l.match(/^([A-Z_]+)=(.*)$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2]]),
  )
}

async function fetchStations(key) {
  const res = await fetch(`${NS}/reisinformatie-api/api/v2/stations`, { headers: { 'Ocp-Apim-Subscription-Key': key } })
  if (res.status === 401 || res.status === 403) return { error: 'De key wordt niet geaccepteerd.' }
  if (!res.ok) return { error: `NS API gaf status ${res.status}.` }
  const data = await res.json()
  const stations = data.payload
    .filter((s) => s.heeftVertrektijden)
    .map((s) => ({ code: s.code, name: s.namen.lang, tracks: s.sporen.map((t) => t.spoorNummer) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'nl'))
  return { stations }
}

const natural = (a, b) => a.localeCompare(b, 'nl', { numeric: true })

async function main() {
  console.log(`
${bold('DRIS')} ${dim('— de vertrekschermen van het perron, op je eigen scherm')}
`)

  // 1. API-key
  const env = readEnv()
  let key = env.NS_API_KEY ?? ''
  let stations
  if (key) {
    const keep = await ask(`Er staat al een API-key in ${ENV}. Die houden? ${dim('[J/n]')} `)
    if (/^n/i.test(keep)) key = ''
  }
  if (!key) {
    console.log(`${bold('1. NS API-key')}
DRIS haalt de vertrektijden bij NS op. Daarvoor heb je een (gratis) key nodig:
  1. Maak een account op ${yellow('https://apiportal.ns.nl')}
  2. Ga naar ${bold('Products')} en abonneer je op ${bold('Ns-App')}
  3. Open je ${bold('Profile')} en kopieer de ${bold('Primary key')}
${dim('De key blijft op deze computer, in ' + ENV + '. Hij komt niet in de image en niet in de browser.')}
`)
  }
  for (;;) {
    if (!key) key = await askSecret('Plak je key hier (je ziet niets verschijnen, dat klopt): ')
    if (!key) continue
    process.stdout.write(dim('Key testen… '))
    try {
      const r = await fetchStations(key)
      if (r.stations) {
        stations = r.stations
        console.log(`werkt ✓ ${dim(`(${stations.length} stations)`)}\n`)
        break
      }
      console.log(red(r.error))
    } catch (e) {
      console.log(red(`geen verbinding met NS (${e.message}).`))
    }
    key = ''
  }

  // 2. Eerste station
  console.log(`${bold('2. Je eerste station')}
${dim('Dit wordt de startpagina. Later kun je alles wijzigen op /dris/info/.')}`)
  let station
  while (!station) {
    const q = (await ask('Zoek een station: ')).toLowerCase()
    if (!q) continue
    const hits = stations
      .filter((s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase() === q)
      .sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)))
      .slice(0, 9)
    if (!hits.length) {
      console.log(dim('Niets gevonden, probeer een ander deel van de naam.'))
      continue
    }
    if (hits.length === 1) {
      station = hits[0]
      break
    }
    hits.forEach((s, i) => console.log(`  ${bold(i + 1)}  ${s.name} ${dim(s.code)}`))
    const n = Number(await ask(`Welke? ${dim('[1-' + hits.length + ', Enter = opnieuw zoeken]')} `))
    if (n >= 1 && n <= hits.length) station = hits[n - 1]
  }
  console.log(`→ ${bold(station.name)}\n`)

  const tracks = [...new Set(station.tracks)].sort(natural)
  console.log(`Sporen: ${tracks.join('  ')}`)
  let track
  for (;;) {
    track = await ask(`Welk spoor? ${dim('[Enter = overzicht van alle vertrekken]')} `)
    if (!track || tracks.includes(track) || tracks.some((t) => t.startsWith(track) && /^[a-z]$/i.test(t.slice(track.length)))) break
    console.log(dim('Dat spoor heeft dit station niet.'))
  }

  const p = new URLSearchParams({ station: station.code })
  if (track) p.set('spoor', track)
  else {
    p.set('indeling', 'overview')
    p.set('weergave', 'screen')
  }
  const start = `/dris/?${p}`

  // 3. Poort
  const port = (await ask(`\n${bold('3. Poort')} op deze computer ${dim('[Enter = ' + (env.DRIS_PORT || '8080') + ']')} `)) || env.DRIS_PORT || '8080'

  writeFileSync(
    ENV,
    `# Gemaakt door setup.sh. Deze file bevat je NS API-key: deel hem niet.
NS_API_KEY=${key}
DRIS_PORT=${port}
DRIS_START=${start}
`,
    { mode: 0o600 },
  )
  chmodSync(ENV, 0o600)
  console.log(`\n${ENV} opgeslagen ✓`)
  rl.close()
}

main().catch((e) => {
  console.error(red(e.stack ?? String(e)))
  process.exit(1)
})
