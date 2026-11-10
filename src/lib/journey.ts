/**
 * One train's journey (the screens inside the train): all stops with their times, and which part of the
 * trip the train is in right now.
 */
import { fetchDepartures } from './api'
import type { Departure } from './types'

export interface JourneyStop {
  /** Station code, e.g. "UT" (from the stop id "UT_0") */
  code: string
  name: string
  uic: string
  plannedArrival?: Date
  arrival?: Date
  plannedDeparture?: Date
  departure?: Date
  track: string
  /** Delay on arrival in whole minutes (0 when on time or early) */
  delayMin: number
}

export interface Journey {
  number: string
  /** e.g. "IC", "SPR" */
  productShort: string
  productLong: string
  operatorCode: string
  destination: string
  /** Only the stops where the train actually stops (passing and cancelled stops left out) */
  stops: JourneyStop[]
}

interface RawTime {
  product: { number: string; categoryCode: string; longCategoryName: string; operatorCode: string }
  destination?: { name: string }
  plannedTime?: string
  actualTime?: string
  plannedTrack?: string
  actualTrack?: string
  cancelled?: boolean
}

interface RawStop {
  id: string
  stop: { name: string; uicCode: string }
  status: string
  arrivals: RawTime[]
  departures: RawTime[]
}

const BASE = `${import.meta.env.BASE_URL}api/ns`

const date = (s?: string) => (s ? new Date(s) : undefined)

function normalizeStop(r: RawStop): JourneyStop | null {
  const a = r.arrivals[0]
  const d = r.departures[0]
  if (!a && !d) return null
  if ((a?.cancelled ?? true) && (d?.cancelled ?? true)) return null
  const plannedArrival = date(a?.plannedTime)
  const arrival = date(a?.actualTime ?? a?.plannedTime)
  const late = plannedArrival && arrival ? Math.round((arrival.getTime() - plannedArrival.getTime()) / 60000) : 0
  return {
    code: r.id.split('_')[0],
    name: r.stop.name,
    uic: r.stop.uicCode,
    plannedArrival,
    arrival,
    plannedDeparture: date(d?.plannedTime),
    departure: date(d?.actualTime ?? d?.plannedTime),
    track: a?.actualTrack ?? a?.plannedTrack ?? d?.actualTrack ?? d?.plannedTrack ?? '',
    delayMin: Math.max(0, late),
  }
}

export async function fetchJourney(number: string, signal?: AbortSignal): Promise<Journey | null> {
  const res = await fetch(`${BASE}/reisinformatie-api/api/v2/journey?train=${encodeURIComponent(number)}`, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`NS API ${res.status} voor rit ${number}`)
  const raw = (await res.json()) as { payload: { stops: RawStop[] } }
  const all = raw.payload.stops ?? []
  const stops = all
    .filter((s) => s.status !== 'PASSING')
    .map(normalizeStop)
    .filter((s): s is JourneyStop => s !== null)
  if (stops.length < 2) return null
  const first = all.map((s) => s.departures[0] ?? s.arrivals[0]).find(Boolean)!
  return {
    number,
    productShort: first.product.categoryCode,
    productLong: first.product.longCategoryName,
    operatorCode: first.product.operatorCode,
    // A train that terminates early ends at its last remaining stop.
    destination: stops[stops.length - 1].name,
    stops,
  }
}

/** Departures at a stop, for "U kunt hier overstappen". */
export function fetchStopDepartures(uic: string, signal?: AbortSignal): Promise<Departure[]> {
  return fetchDepartures(`uic:${uic}`, signal)
}

/* ---------- Where is the train now? ---------- */

export type TrainView =
  /** On the way: the next stop, and the last few stops of the trip below it */
  | { kind: 'running'; next: JourneyStop; later: JourneyStop[] }
  /** Almost at (or standing at) the next stop: its track and the connections there */
  | { kind: 'arriving'; next: JourneyStop; later: JourneyStop[] }
  /** The next stop is the last one */
  | { kind: 'terminus'; next: JourneyStop }
  /** Arrived at the last stop some time ago */
  | { kind: 'ended'; next: JourneyStop }

/** From this long before arriving at a stop the screen shows its track and connections (as in the photos). */
export const ARRIVING_MS = 3 * 60_000
/** After arriving at the last stop the screen keeps showing it this long. */
export const ENDED_MS = 3 * 60_000
/** At most this many stops below the next one: the last stops of the trip, ending with the destination. */
export const LATER_ROWS = 3

/**
 * The view for this moment. `fromCode`: the station where you got on; stops before it are skipped and it is
 * never shown as a place to change trains.
 */
export function trainView(j: Journey, now: Date, fromCode = ''): TrainView {
  const t = now.getTime()
  const stops = j.stops
  const board = Math.max(0, stops.findIndex((s) => s.code === fromCode.toUpperCase()))
  const last = stops.length - 1
  // The next stop is the first one the train has not left yet (it stays "next" while the train stands there).
  let i = stops.findIndex((s, k) => k > 0 && k >= board && ((s.departure ?? s.arrival)?.getTime() ?? 0) > t)
  if (i === -1) i = last
  const next = stops[i]
  if (i === last) {
    const arrived = next.arrival && t >= next.arrival.getTime() + ENDED_MS
    return { kind: arrived ? 'ended' : 'terminus', next }
  }
  const later = stops.slice(i + 1).slice(-LATER_ROWS)
  const soon = next.arrival && next.arrival.getTime() - t <= ARRIVING_MS
  return { kind: soon && i > board ? 'arriving' : 'running', next, later }
}

/** Connections at the next stop: departures from a minute after our arrival, not our own train. */
export function connections(list: Departure[], view: TrainView, ownNumber: string, max = 3): Departure[] {
  if (view.kind !== 'arriving') return []
  const from = (view.next.arrival?.getTime() ?? 0) + 60_000
  return list
    .filter((d) => d.number !== ownNumber && !d.cancelled && d.actual.getTime() >= from)
    .sort((a, b) => a.actual.getTime() - b.actual.getTime())
    .slice(0, max)
}

/**
 * Where you would be if you got off now: the stop the train is standing at, otherwise the next stop it
 * runs to. Before it leaves the boarding station that is the boarding station; at the end, the last stop.
 */
export function rideStop(j: Journey, now: Date, fromCode = ''): JourneyStop {
  const t = now.getTime()
  const stops = j.stops
  const board = Math.max(0, stops.findIndex((s) => s.code === fromCode.toUpperCase()))
  const i = stops.findIndex((s, k) => k >= board && ((s.departure ?? s.arrival)?.getTime() ?? 0) > t)
  return stops[i === -1 ? stops.length - 1 : i]
}
