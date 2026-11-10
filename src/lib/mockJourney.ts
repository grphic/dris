import type { Journey, JourneyStop } from './journey'
import type { Departure } from './types'

/**
 * Demo for the train screen: an Intercity Den Haag Centraal → Enschede that runs 12× faster than real time
 * (one minute per 5 s beat), round and round, so every state of the screen comes by.
 */
export const DEMO_SPEED = 12

// [name, code, uic, arrival min, departure min, track, delay]
const ROUTE: [string, string, string, number | null, number | null, string, number][] = [
  ['Den Haag Centraal', 'GVC', '8400282', null, 0, '11', 0],
  ['Gouda', 'GD', '8400258', 18, 19, '8', 0],
  ['Utrecht Centraal', 'UT', '8400621', 38, 42, '18', 0],
  ['Amersfoort Centraal', 'AMF', '8400055', 56, 57, '5', 0],
  ['Apeldoorn', 'APD', '8400045', 80, 81, '2', 3],
  ['Deventer', 'DV', '8400173', 92, 94, '3', 3],
  ['Almelo', 'AML', '8400050', 115, 116, '4', 2],
  ['Hengelo', 'HGL', '8400334', 124, 125, '2', 2],
  ['Enschede', 'ES', '8400221', 132, null, '3', 1],
]
const BEFORE_MIN = 2
const AFTER_MIN = 6
const LOOP_MIN = BEFORE_MIN + 132 + AFTER_MIN
const REAL_LOOP_MS = (LOOP_MIN * 60_000) / DEMO_SPEED

/** Start of the current loop (real time) and the simulated departure from Den Haag. */
function loop(real: number) {
  const start = real - (real % REAL_LOOP_MS)
  const departure = Math.floor(start / 60_000) * 60_000 + BEFORE_MIN * 60_000
  return { start, departure }
}

/** Dev server only: `t=<minutes>` stops the demo that many minutes after the departure from Den Haag (for screenshots). */
const FREEZE = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('t') : null

/** The simulated time for a real moment. */
export function demoNow(real = Date.now()): Date {
  const { start, departure } = loop(real)
  if (FREEZE !== null) return new Date(departure + Number(FREEZE) * 60_000)
  return new Date(departure - BEFORE_MIN * 60_000 + (real - start) * DEMO_SPEED)
}

export function demoJourney(real = Date.now()): Journey {
  const { departure } = loop(real)
  const at = (min: number | null, delay: number) => (min === null ? undefined : new Date(departure + (min + delay) * 60_000))
  const stops: JourneyStop[] = ROUTE.map(([name, code, uic, arr, dep, track, delay]) => ({
    code,
    name,
    uic,
    plannedArrival: at(arr, 0),
    arrival: at(arr, delay),
    plannedDeparture: at(dep, 0),
    departure: at(dep, delay),
    track,
    delayMin: arr === null ? 0 : delay,
  }))
  return {
    number: '1758',
    productShort: 'IC',
    productLong: 'Intercity',
    operatorCode: 'NS',
    destination: 'Enschede',
    stops,
  }
}

// Connections per station: [minutes after our arrival, direction, track, product]
const CONNECTIONS: Record<string, [number, string, string, string][]> = {
  GD: [[4, 'Rotterdam Centraal', '5', 'IC'], [6, 'Alphen a/d Rijn', '1', 'SPR'], [9, 'Amsterdam Centraal', '7', 'IC']],
  UT: [[3, 'Amsterdam Centraal', '7', 'IC'], [4, 'Schiphol Airport', '14', 'IC'], [6, "'s-Hertogenbosch", '21', 'SPR']],
  AMF: [[4, 'Leeuwarden', '6', 'IC'], [5, 'Groningen', '6', 'IC'], [8, 'Ede-Wageningen', '4', 'SPR']],
  APD: [[5, 'Zutphen', '1', 'SPR'], [8, 'Amersfoort Centraal', '3', 'IC']],
  DV: [[3, 'Zwolle', '5', 'SPR'], [4, 'Nijmegen', '6', 'SPR'], [7, 'Arnhem Centraal', '4', 'SPR']],
  AML: [[4, 'Mariënberg', '1', 'SPR'], [6, 'Zwolle', '2', 'SPR']],
  HGL: [[3, 'Zutphen', '4', 'SPR'], [5, 'Oldenzaal', '1', 'IC'], [9, 'Bielefeld Hbf', '5', 'RE']],
}

const LONG: Record<string, string> = { IC: 'Intercity', SPR: 'Sprinter', RE: 'Regional-Express' }

export function demoDepartures(code: string, arrival: Date): Departure[] {
  return (CONNECTIONS[code] ?? []).map(([min, direction, track, product], i) => {
    const t = new Date(arrival.getTime() + min * 60_000)
    return {
      id: `demo-${code}-${i}`,
      number: String(9000 + i),
      planned: t,
      actual: t,
      delayMin: 0,
      plannedTrack: track,
      track,
      direction,
      productLong: LONG[product] ?? product,
      productShort: product,
      operatorCode: 'NS',
      operatorName: 'NS',
      cancelled: false,
      via: [],
      warnings: [],
      infos: [],
    }
  })
}
