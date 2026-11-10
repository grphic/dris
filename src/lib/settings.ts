export type Theme = 'dark' | 'light'
/** Screen only, screen with track signs, or screen with track signs and clock. */
export type Frame = 'screen' | 'signs' | 'board'
/** One or two trains for a track, or the departures overview for the whole station. */
export type Layout = 'single' | 'double' | 'overview'
export type Lang = 'alt' | 'nl' | 'en'
export type Side = 'left' | 'right'
/** Clock panel: a square white panel with a large clock, or a narrower grey one with a smaller clock
 *  in the middle or at the top. */
export type ClockStyle = 'square' | 'center' | 'top'

export interface Settings {
  station: string
  stationName: string
  /** One track for single layout; double layout may use a second track */
  track: string
  track2: string
  theme: Theme
  frame: Frame
  layout: Layout
  lang: Lang
  /** Side of the board the track sign is on (clock goes on the other side) */
  side: Side
  clock: ClockStyle
  /** Overview: number of screens side by side; the list continues from one screen to the next. */
  screens: number
  /** Overview: show only this screen (1-based) of the row, e.g. one per TV; 0 = all screens side by side. */
  screen: number
  mock: boolean
}

export const DEFAULTS: Settings = {
  station: '',
  stationName: '',
  track: '',
  track2: '',
  theme: 'dark',
  frame: 'board',
  layout: 'single',
  lang: 'alt',
  side: 'left',
  clock: 'center',
  screens: 1,
  screen: 0,
  mock: false,
}

function pick<T extends string>(v: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback
}

const CLOCK_PARAM: Record<ClockStyle, string> = { square: 'vierkant', center: 'midden', top: 'boven' }

function readClock(p: URLSearchParams): ClockStyle {
  const v = p.get('klok')
  const hit = (Object.keys(CLOCK_PARAM) as ClockStyle[]).find((k) => CLOCK_PARAM[k] === v)
  if (hit) return hit
  // Older links: klokvlak=vierkant / klokpositie=boven.
  if (p.get('klokvlak') === 'vierkant') return 'square'
  if (p.get('klokpositie') === 'boven') return 'top'
  return DEFAULTS.clock
}

export function readSettings(search: string): Settings {
  const p = new URLSearchParams(search)
  return {
    station: (p.get('station') ?? '').toUpperCase(),
    stationName: p.get('naam') ?? '',
    track: p.get('spoor') ?? '',
    track2: p.get('spoor2') ?? '',
    theme: pick(p.get('thema'), ['dark', 'light'] as const, DEFAULTS.theme),
    frame: pick(p.get('weergave'), ['screen', 'signs', 'board'] as const, DEFAULTS.frame),
    layout: pick(p.get('indeling'), ['single', 'double', 'overview'] as const, DEFAULTS.layout),
    lang: pick(p.get('taal'), ['alt', 'nl', 'en'] as const, DEFAULTS.lang),
    side: pick(p.get('bordzijde'), ['left', 'right'] as const, DEFAULTS.side),
    clock: readClock(p),
    screens: Math.min(3, Math.max(1, Number(p.get('schermen')) || 1)),
    screen: Number(p.get('scherm')) || 0,
    mock: p.get('demo') === '1',
  }
}

/** The link for these settings, as short as possible: only what differs from the defaults. */
export function toQuery(s: Settings): string {
  const p = new URLSearchParams()
  const set = (key: string, value: string, fallback: string) => value !== fallback && p.set(key, value)
  if (s.station) p.set('station', s.station)
  if (s.layout !== 'overview' && s.track) p.set('spoor', s.track)
  if (s.layout === 'double' && s.track2 && s.track2 !== s.track) p.set('spoor2', s.track2)
  set('indeling', s.layout, DEFAULTS.layout)
  if (s.layout === 'overview') {
    set('schermen', String(s.screens), '1')
    if (s.screen > 0 && s.screen <= s.screens) p.set('scherm', String(s.screen))
  }
  // The overview has no track signs: 'signs' and 'board' both mean "in the housing" there.
  set('weergave', s.layout === 'overview' && s.frame === 'signs' ? 'board' : s.frame, DEFAULTS.frame)
  set('thema', s.theme, DEFAULTS.theme)
  set('taal', s.lang, DEFAULTS.lang)
  const signs = s.frame !== 'screen' && s.layout !== 'overview'
  if (signs) set('bordzijde', s.side, DEFAULTS.side)
  if (signs && s.frame === 'board') set('klok', CLOCK_PARAM[s.clock], CLOCK_PARAM[DEFAULTS.clock])
  if (s.mock) p.set('demo', '1')
  return p.toString()
}

/** Matches a departure track against the selected track. "9" matches 9, 9a and 9b; "9a" only 9a. */
export function trackMatches(selected: string, actual: string): boolean {
  const sel = selected.trim().toLowerCase()
  const act = actual.trim().toLowerCase()
  if (!sel) return false
  if (sel === act) return true
  return /^\d+$/.test(sel) && new RegExp(`^${sel}[a-z]$`).test(act)
}
