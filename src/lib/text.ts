import { useMemo, useSyncExternalStore } from 'react'
import type { Lang } from './settings'

const TZ = 'Europe/Amsterdam'
const hm = new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: TZ })

export const formatTime = (d: Date) => hm.format(d)

const STRINGS = {
  nl: {
    en: false,
    next: 'Volgende trein',
    min1: 'minuut',
    minN: 'minuten',
    cancelled: 'Rijdt niet',
    via: 'via',
    and: 'en',
    noData: 'Geen vertrekinformatie beschikbaar',
    noTrains: 'Geen treinen',
    lessThan1: '< 1',
    departure: 'Vertrek',
    toRemarks: 'Naar/Opmerking',
    platform: 'Spoor',
  },
  en: {
    en: true,
    next: 'Next train',
    min1: 'minute',
    minN: 'minutes',
    cancelled: 'Cancelled',
    via: 'via',
    and: 'en', // the via line is not translated on the real boards: "via A, B en C" in English too
    noData: 'No departure information available',
    noTrains: 'No trains',
    lessThan1: '< 1',
    departure: 'Departure',
    toRemarks: 'To/Remarks',
    platform: 'Platform',
  },
}
export type Strings = (typeof STRINGS)['nl'] | (typeof STRINGS)['en']
export const STRINGS_NL = STRINGS.nl
export const STRINGS_EN = STRINGS.en

/** Alternating Dutch/English texts, like the real boards. */
/** Language switch interval in 'alt' mode, as on the real boards. */
export const LANG_MS = 5000

/**
 * One shared beat on the wall clock (every LANG_MS, on whole multiples of it). Everything that changes text on
 * screen (language, countdown, clock, paging, new data) moves on this beat, so it all changes in one render
 * instead of one text flipping and another following a moment later. Clock-aligned, so separate screens agree.
 */
let beat = Math.floor(Date.now() / LANG_MS)
let timer = 0
const listeners = new Set<() => void>()
function schedule() {
  timer = window.setTimeout(
    () => {
      beat = Math.floor(Date.now() / LANG_MS)
      // One timer for all subscribers: React batches the updates into a single render.
      listeners.forEach((l) => l())
      schedule()
    },
    LANG_MS - (Date.now() % LANG_MS) + 5,
  )
}
function subscribe(l: () => void) {
  if (!listeners.size) {
    beat = Math.floor(Date.now() / LANG_MS)
    schedule()
  }
  listeners.add(l)
  return () => {
    listeners.delete(l)
    if (!listeners.size) clearTimeout(timer)
  }
}
const getBeat = () => beat

/** The current beat number (increments every LANG_MS). */
export function useBeat(): number {
  return useSyncExternalStore(subscribe, getBeat)
}

/** Board texts; in 'alt' mode Dutch and English alternate every 5 s, Dutch on even beats. */
export function useStrings(lang: Lang): Strings {
  const b = useBeat()
  return STRINGS[lang === 'en' || (lang === 'alt' && b % 2 === 1) ? 'en' : 'nl']
}

/** The time at the current beat, for countdowns and the clock (minute changes fall on a beat). */
export function useNow(): Date {
  const b = useBeat()
  return useMemo(() => new Date(Math.max(Date.now(), b * LANG_MS)), [b])
}

/** "A, B, C en D" */
export function joinVia(list: string[], and: string): string {
  if (list.length <= 1) return list.join('')
  return `${list.slice(0, -1).join(', ')} ${and} ${list[list.length - 1]}`
}

/** Countdown is shown from this many minutes before departure. */
export const COUNTDOWN_FROM_MIN = 10
