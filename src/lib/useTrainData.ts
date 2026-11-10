import { useEffect, useRef, useState } from 'react'
import { fetchTrainType } from './api'
import { connections, fetchJourney, fetchStopDepartures, rideStop, trainView, type Journey, type TrainView } from './journey'
import { demoDepartures, demoJourney, demoNow } from './mockJourney'
import { rideKey, writeRide } from './ride'
import { trackMatches, type Settings } from './settings'
import { LANG_MS, useBeat } from './text'
import type { Departure } from './types'

const POLL_MS = 30_000
const RETRY_MS = 5_000
const STALE_MS = 5 * 60_000
const CONNECTIONS_TTL_MS = 60_000
/** A followed train is remembered across a reload for at most this long. */
const LOCK_MAX_MS = 6 * 60 * 60_000
/** The rolling stock rarely changes during a trip: look it up again after this long. */
const MATERIAL_TTL_MS = 10 * 60_000

export interface Material {
  /** "SLT", "VIRM", "ICM", "SNG", … */
  type: string
  /** Number of the first unit, e.g. "2455" (shown at the bottom of the SLT screen) */
  unit: string
}

export interface TrainData {
  journey: Journey | null
  view: TrainView | null
  connections: Departure[]
  /** Rolling stock of the train, null while unknown (or in demo mode) */
  material: Material | null
  /** The time on the screen (simulated in demo mode) */
  now: Date
  loaded: boolean
  stale: boolean
}

/* The followed train is kept in sessionStorage, so a reload halfway through the trip keeps following it. */
const lockKey = (s: Settings) => `dris.train.${s.station}|${s.track}`
function readLock(s: Settings): string {
  try {
    const v = JSON.parse(sessionStorage.getItem(lockKey(s)) ?? 'null')
    if (v && Date.now() - v.time < LOCK_MAX_MS) return v.number
  } catch {
    /* ignore */
  }
  return ''
}
function writeLock(s: Settings, number: string) {
  try {
    if (number) sessionStorage.setItem(lockKey(s), JSON.stringify({ number, time: Date.now() }))
    else sessionStorage.removeItem(lockKey(s))
  } catch {
    /* ignore */
  }
}

/**
 * The train to show: a fixed train number (`trein=`), or (station + track) the next train leaving there,
 * followed until the end of its trip; then the next one.
 */
export function useTrainData(s: Settings, stationDepartures: Departure[]): TrainData {
  const beat = useBeat()
  const now = s.mock ? demoNow() : new Date(Math.max(Date.now(), beat * LANG_MS))
  const follow = !s.train && !s.mock
  const [locked, setLocked] = useState(() => (follow ? readLock(s) : ''))
  const number = s.mock ? 'demo' : s.train || locked

  const [journey, setJourney] = useState<Journey | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [lastOk, setLastOk] = useState(0)
  const [failed, setFailed] = useState(0)

  // Following: take the first train that leaves from the chosen track (any track when none is chosen).
  useEffect(() => {
    if (!follow || locked) return
    const pick = stationDepartures.find((d) => !d.cancelled && (!s.track || trackMatches(s.track, d.track)))
    if (!pick) return
    setLocked(pick.number)
    writeLock(s, pick.number)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [follow, locked, stationDepartures, s.station, s.track])

  // Poll the journey of the train.
  useEffect(() => {
    setJourney(null)
    setLoaded(false)
    if (!number) return
    if (s.mock) {
      setLoaded(true)
      return
    }
    const ctrl = new AbortController()
    let timer = 0
    let failures = 0
    const load = async () => {
      try {
        const j = await fetchJourney(number, ctrl.signal)
        if (!j && follow) {
          // No trip for this number (any more): follow the next train.
          setLocked('')
          writeLock(s, '')
          return
        }
        setJourney(j)
        setLastOk(Date.now())
        failures = 0
        setFailed(0)
      } catch (e) {
        if (ctrl.signal.aborted) return
        console.warn(e)
        failures++
        setFailed(failures)
      }
      setLoaded(true)
      if (!ctrl.signal.aborted) timer = window.setTimeout(load, failures ? RETRY_MS : POLL_MS)
    }
    load()
    return () => {
      ctrl.abort()
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [number, s.mock])

  const shown = s.mock ? demoJourney() : journey
  const view = shown ? trainView(shown, now, follow ? s.station : '') : null

  // Following: at the end of the trip, move on to the next train from the station.
  const ended = follow && view?.kind === 'ended'
  useEffect(() => {
    if (!ended) return
    setLocked('')
    writeLock(s, '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended])

  // Connections at the next stop, while arriving there.
  const cache = useRef(new Map<string, { time: number; list: Departure[] }>())
  const [, setVersion] = useState(0)
  const stopUic = view?.kind === 'arriving' ? view.next.uic : ''
  useEffect(() => {
    if (!stopUic || s.mock) return
    const hit = cache.current.get(stopUic)
    if (hit && Date.now() - hit.time < CONNECTIONS_TTL_MS) return
    cache.current.set(stopUic, { time: Date.now(), list: hit?.list ?? [] })
    let alive = true
    fetchStopDepartures(stopUic)
      .then((list) => {
        cache.current.set(stopUic, { time: Date.now(), list })
        if (alive) setVersion((v) => v + 1)
      })
      .catch(() => {
        /* no connections: the screen shows the route instead */
      })
    return () => {
      alive = false
    }
  }, [stopUic, s.mock, Math.floor(beat / (CONNECTIONS_TTL_MS / LANG_MS))])

  let list: Departure[] = []
  if (view?.kind === 'arriving') {
    list = s.mock ? demoDepartures(view.next.code, view.next.arrival ?? now) : (cache.current.get(stopUic)?.list ?? [])
  }

  // Rolling stock: decides between the OBIS screen and the SLT screen.
  const [material, setMaterial] = useState<Material | null>(null)
  const materialAt = view && !s.mock ? (view.next.code || shown?.stops[0].code || '') : ''
  const materialNumber = shown && !s.mock ? shown.number : ''
  const materialSlot = Math.floor(beat / (MATERIAL_TTL_MS / LANG_MS))
  useEffect(() => {
    if (!materialNumber) {
      setMaterial(null)
      return
    }
    if (!materialAt) return
    const ctrl = new AbortController()
    fetchTrainType(materialNumber, materialAt, ctrl.signal)
      .then((m) => m && setMaterial(m))
      .catch(() => {
        /* unknown: keep what we had */
      })
    return () => ctrl.abort()
    // Look up once per train and then every MATERIAL_TTL_MS, not on every stop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialNumber, materialSlot])
  useEffect(() => setMaterial(null), [materialNumber])

  // Tell the settings page where this train is now (see ride.ts).
  const here = shown && !s.mock ? rideStop(shown, now, follow ? s.station : '') : null
  useEffect(() => {
    if (!shown || !here) return
    writeRide({
      key: rideKey(s),
      number: shown.number,
      product: shown.productShort,
      destination: shown.destination,
      code: here.code,
      name: here.name,
      track: here.track,
      material: material?.type ?? '',
      time: Date.now(),
    })
    // Rewritten every beat, so the settings page can tell an open screen from a closed one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beat, shown?.number, here?.code, material?.type])

  const stale = !s.mock && (lastOk ? Date.now() - lastOk > STALE_MS : failed >= 3)
  return {
    journey: shown,
    view,
    connections: view && shown ? connections(list, view, shown.number) : [],
    material: s.mock ? null : material,
    now,
    loaded: s.mock || loaded,
    stale,
  }
}
