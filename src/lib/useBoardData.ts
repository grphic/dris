import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useBeat } from './text'
import { fetchComposition, fetchDepartures } from './api'
import { mockComposition, mockDepartures, mockOverview } from './mock'
import type { Settings } from './settings'
import { trackMatches } from './settings'
import type { Composition, Departure } from './types'

const POLL_MS = 30_000
const STALE_MS = 5 * 60_000
const RETRY_MS = 5_000
const COMPOSITION_TTL_MS = 3 * 60_000

export interface Slot {
  track: string
  current?: Departure
  next?: Departure
  composition?: Composition | null
}

export interface BoardData {
  slots: Slot[]
  /** All upcoming departures at the station (for the overview) */
  departures: Departure[]
  stale: boolean
  loaded: boolean
}

/** Departures still on the board: not yet departed (by actual time), with a 30 s grace period. */
function upcoming(list: Departure[]): Departure[] {
  const cutoff = Date.now() - 30_000
  return list.filter((d) => d.actual.getTime() >= cutoff)
}

function buildSlots(all: Departure[], s: Settings): Slot[] {
  const deps = upcoming(all)
  const onTrack = (t: string) => deps.filter((d) => trackMatches(t, d.track))
  const first = onTrack(s.track)
  if (s.layout === 'single') return [{ track: s.track, current: first[0], next: first[1] }]
  if (s.track2 && s.track2 !== s.track) {
    const second = onTrack(s.track2)
    return [
      { track: s.track, current: first[0], next: first[1] },
      { track: s.track2, current: second[0], next: second[1] },
    ]
  }
  // Double layout on one track: the two upcoming trains, each with the train after it.
  return [
    { track: s.track, current: first[0], next: first[2] ?? first[1] },
    { track: s.track, current: first[1], next: first[2] },
  ]
}

export function useBoardData(s: Settings): BoardData {
  const [departures, setDepartures] = useState<Departure[]>([])
  const [lastOk, setLastOk] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(0)
  // New data waits for the next beat, so it never changes the screen just after a language switch.
  const pending = useRef<Departure[] | null>(null)
  const beat = useBeat()
  const compositions = useRef(new Map<string, { time: number; value: Composition | null }>())
  const [, setCompVersion] = useState(0)

  // Another station (or demo on/off): never keep showing the previous station's trains.
  const source = `${s.station}|${s.mock}`
  const [prevSource, setPrevSource] = useState(source)
  if (source !== prevSource) {
    setPrevSource(source)
    setDepartures([])
    setLoaded(false)
    setLastOk(0)
    setFailed(0)
  }

  // Poll departures; retry sooner after a failure.
  useEffect(() => {
    if (!s.station && !s.mock) return
    const ctrl = new AbortController()
    let timer = 0
    let first = true // new settings: show the first answer at once
    pending.current = null
    let failures = 0
    const load = async () => {
      try {
        const list = s.mock
          ? s.layout === 'overview'
            ? mockOverview()
            : mockDepartures(s.track, s.track2)
          : await fetchDepartures(s.station, ctrl.signal, s.lang !== 'nl')
        // First data straight away; after that on the beat.
        if (first) setDepartures(list)
        else pending.current = list
        first = false
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
  }, [s.station, s.mock, s.track, s.track2, s.lang, s.layout])

  // Every beat: apply data that came in since the last one (before paint, so in the same frame). The beat also
  // re-renders, so departed trains drop off between polls.
  useLayoutEffect(() => {
    if (!pending.current) return
    setDepartures(pending.current)
    pending.current = null
  }, [beat])

  const slots = buildSlots(departures, s)

  // Fetch compositions for trains on screen (cached).
  const wanted = slots
    .map((sl) => sl.current?.number)
    .filter(Boolean)
    .join(',')
  useEffect(() => {
    let alive = true
    for (const number of wanted.split(',').filter(Boolean)) {
      const hit = compositions.current.get(number)
      if (hit && Date.now() - hit.time < COMPOSITION_TTL_MS) continue
      // Mark as fetched now (keeping any old value) so failures are retried only after the TTL.
      compositions.current.set(number, { time: Date.now(), value: hit?.value ?? null })
      const p = s.mock ? Promise.resolve(mockComposition()) : fetchComposition(number, s.station)
      p.then((value) => {
        compositions.current.set(number, { time: Date.now(), value })
        if (alive) setCompVersion((v) => v + 1)
      }).catch(() => {
        /* no composition available: keep the generic train */
      })
    }
    return () => {
      alive = false
    }
  }, [wanted, s.station, s.mock, Math.floor(Date.now() / COMPOSITION_TTL_MS)])

  for (const sl of slots) {
    if (sl.current) sl.composition = compositions.current.get(sl.current.number)?.value
  }

  const stale = lastOk ? Date.now() - lastOk > STALE_MS : failed >= 3
  return { slots, departures: upcoming(departures), loaded, stale }
}
