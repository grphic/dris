import type { Composition, Departure, Station } from './types'

/** Proxied by Vite in dev and by Caddy in production; the key is added there. */
const BASE = `${import.meta.env.BASE_URL}api/ns`

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`NS API ${res.status} voor ${path}`)
  return res.json() as Promise<T>
}

/* ---------- Departures ---------- */

interface RawDeparture {
  direction: string
  recognizableDestination?: { code: string; name: string }
  name: string
  plannedDateTime: string
  actualDateTime?: string
  plannedTrack?: string
  actualTrack?: string
  product: {
    number: string
    categoryCode: string
    longCategoryName: string
    operatorCode: string
    operatorName: string
  }
  cancelled: boolean
  routeStations: { mediumName: string }[]
  messages?: { message: string; style: 'INFO' | 'WARNING' | string }[]
}

/** Our own warning for a changed departure track. */
export function trackChangeText(track: string, en: boolean) {
  return en ? `Please note: departs from platform ${track}` : `Let op: vertrekt van spoor ${track}`
}

const SHORTENED = /^Rijdt niet verder dan (.+?)(?: door .*)?$/i

function normalizeDeparture(r: RawDeparture): Departure {
  const planned = new Date(r.plannedDateTime)
  const actual = new Date(r.actualDateTime ?? r.plannedDateTime)
  // Boards show delays in steps of 5, from 4 minutes: 4–7 → +5, 8–12 → +10, 13–17 → +15, …
  const late = Math.round((actual.getTime() - planned.getTime()) / 60000)
  const delayMin = late < 4 ? 0 : Math.round(late / 5) * 5
  const messages = r.messages ?? []
  let direction = r.direction
  let originalDirection: string | undefined
  for (const m of messages) {
    const hit = SHORTENED.exec(m.message)
    if (hit && hit[1] !== direction) {
      originalDirection = direction
      direction = hit[1]
    }
  }
  const track = r.actualTrack ?? r.plannedTrack ?? ''
  const plannedTrack = r.plannedTrack ?? track
  const warnings = messages.filter((m) => m.style === 'WARNING').map((m) => m.message)
  const infos = messages.filter((m) => m.style !== 'WARNING').map((m) => m.message)
  if (track && plannedTrack && track !== plannedTrack) {
    warnings.unshift(trackChangeText(track, false))
  }
  return {
    id: `${r.product.number}-${r.plannedDateTime}`,
    number: r.product.number,
    planned,
    actual,
    delayMin,
    plannedTrack,
    track,
    direction,
    originalDirection,
    // The name may contain "✈"; the board draws its own airplane pictogram.
    viaHighlight: r.recognizableDestination?.name.replace(/✈/g, '').trim() || undefined,
    productLong: r.product.longCategoryName,
    productShort: r.product.categoryCode,
    operatorCode: r.product.operatorCode,
    operatorName: r.product.operatorName,
    cancelled: r.cancelled,
    via: r.routeStations.map((s) => s.mediumName),
    warnings,
    infos,
  }
}

/** `station` is a station code, or "uic:<uicCode>" (the stops of a journey only have their UIC code). */
const departuresPath = (station: string, lang: 'nl' | 'en') => {
  const where = station.startsWith('uic:') ? `uicCode=${encodeURIComponent(station.slice(4))}` : `station=${encodeURIComponent(station)}`
  return `/reisinformatie-api/api/v2/departures?${where}&maxJourneys=60&lang=${lang}`
}

/**
 * Departures with Dutch texts; with `english` the English messages are fetched as well and added as
 * warningsEn/infosEn (the board alternates languages). If the English request fails, Dutch is used.
 */
export async function fetchDepartures(station: string, signal?: AbortSignal, english = false): Promise<Departure[]> {
  type Payload = { payload: { departures: RawDeparture[] } }
  const [nl, en] = await Promise.all([
    get<Payload>(departuresPath(station, 'nl'), signal),
    english ? get<Payload>(departuresPath(station, 'en'), signal).catch(() => null) : null,
  ])
  const list = nl.payload.departures.map(normalizeDeparture)
  if (!en) return list
  const byId = new Map(en.payload.departures.map((r) => [`${r.product.number}-${r.plannedDateTime}`, r]))
  for (const d of list) {
    const r = byId.get(d.id)
    if (!r) continue
    const messages = r.messages ?? []
    const warningsEn = messages.filter((m) => m.style === 'WARNING').map((m) => m.message)
    const infosEn = messages.filter((m) => m.style !== 'WARNING').map((m) => m.message)
    if (d.track !== d.plannedTrack) warningsEn.unshift(trackChangeText(d.track, true))
    // Only use the translation when it lines up with the Dutch messages.
    if (warningsEn.length === d.warnings.length) d.warningsEn = warningsEn
    if (infosEn.length === d.infos.length) d.infosEn = infosEn
  }
  return list
}

/* ---------- Stations (cached for a day in localStorage) ---------- */

interface RawStation {
  code: string
  land: string
  heeftVertrektijden: boolean
  namen: { lang: string; middel: string; kort: string }
  sporen: { spoorNummer: string }[]
}

const STATIONS_KEY = 'dris.stations.v2'
const DAY = 24 * 60 * 60 * 1000

function trackSort(a: string, b: string) {
  return parseInt(a) - parseInt(b) || a.localeCompare(b)
}

export async function fetchStations(): Promise<Station[]> {
  try {
    const cached = JSON.parse(localStorage.getItem(STATIONS_KEY) ?? 'null')
    if (cached && Date.now() - cached.time < DAY) return cached.stations
  } catch {
    /* ignore broken cache */
  }
  const data = await get<{ payload: RawStation[] }>('/reisinformatie-api/api/v2/stations')
  const stations: Station[] = data.payload
    .filter((s) => s.heeftVertrektijden)
    .map((s) => ({
      code: s.code,
      name: s.namen.lang,
      nameMedium: s.namen.middel,
      nameShort: s.namen.kort,
      country: s.land,
      tracks: s.sporen.map((t) => t.spoorNummer).sort(trackSort),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'nl'))
  try {
    localStorage.setItem(STATIONS_KEY, JSON.stringify({ time: Date.now(), stations }))
  } catch {
    /* storage full or blocked */
  }
  return stations
}

/* ---------- Virtual Train (composition + platform letters) ---------- */

interface RawVirtualTrain {
  type?: string
  lengteInPixels: number
  rijrichting?: 'RECHTS' | 'LINKS'
  materieeldelen: { breedte: number; bakken: unknown[]; materieelnummer?: number }[]
  perronVoorzieningen?: { type: string; paddingLeft: number; width: number; description: string }[]
}

export async function fetchComposition(number: string, station: string, signal?: AbortSignal): Promise<Composition | null> {
  const r = await get<RawVirtualTrain>(`/virtual-train-api/api/v1/trein/${encodeURIComponent(number)}/${encodeURIComponent(station)}`, signal)
  if (!r.materieeldelen?.length) return null
  return {
    length: r.lengteInPixels,
    parts: r.materieeldelen.map((m) => ({ width: m.breedte, carriages: Math.max(1, m.bakken.length) })),
    letters: (r.perronVoorzieningen ?? [])
      .filter((p) => p.type === 'PERRONLETTER')
      .map((p) => ({ letter: p.description, left: p.paddingLeft, width: p.width })),
    directionRight: r.rijrichting !== 'LINKS',
  }
}

/** Rolling stock of a train at a station: type ("SLT", "VIRM", "ICM", "SNG", …) and the first unit's number. */
export async function fetchTrainType(number: string, station: string, signal?: AbortSignal): Promise<{ type: string; unit: string } | null> {
  const r = await get<RawVirtualTrain>(`/virtual-train-api/api/v1/trein/${encodeURIComponent(number)}/${encodeURIComponent(station)}`, signal)
  if (!r.type) return null
  return { type: r.type.toUpperCase(), unit: String(r.materieeldelen?.[0]?.materieelnummer ?? '') }
}
