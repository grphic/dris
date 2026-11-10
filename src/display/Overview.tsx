import { useId, type CSSProperties } from 'react'
import type { Lang } from '../lib/settings'
import { STRINGS_NL, formatTime, useNow, useStrings, type Strings } from '../lib/text'
import type { Departure } from '../lib/types'
import { ProductStack } from './Product'
import { NoDataScreen, Place, useFitName } from './Screen'

/** Departures per screen on a 16:9 screen, as on the real overview screens. */
export const ROWS = 7
const HEAD_H = 72
const PAGER_H = 52
const ROW_H = 136

/** Responsive: as many rows as fit in a screen of this height (design pixels), at least the usual 7. */
export function rowsFor(height: number) {
  return Math.max(ROWS, Math.floor((height - HEAD_H - PAGER_H) / ROW_H))
}
/** At most this many pages; later trains wait until earlier ones have left. */
const MAX_PAGES = 3
/** Page every 20 s: four language beats, so a new page always starts in Dutch. */
const PAGE_MS = 20_000

/** International trains show their train number in a box ("EST 9147"), as on the real boards. */
const INTERNATIONAL = new Set(['EST', 'ICE', 'NJ', 'EN', 'EC', 'ECD', 'THA', 'INT'])
const isInternational = (d: Departure) => INTERNATIONAL.has(d.productShort.toUpperCase())
/** Eurostar to the UK: passport and customs control first, so the track block shows the customs pictogram. */
const needsCustoms = (d: Departure) => d.productShort.toUpperCase() === 'EST' && /london|londen/i.test(d.direction)

/** Second line of a row: a remark (in the board's language) when there is one, otherwise the via list. */
function SubLine({ d, t }: { d: Departure; t: Strings }) {
  const remark = (list: string[], en?: string[]) => (list.length ? t.en && en?.[0] ? <i className="en">{en[0]}</i> : list[0] : null)
  const warning = remark(d.warnings, d.warningsEn) ?? (d.cancelled ? STRINGS_NL.cancelled : null)
  if (warning) return <span className="ov-warn">{warning}</span>
  const info = remark(d.infos, d.infosEn)
  if (info) return <>{info}</>
  if (!d.via.length) return null
  return (
    <>
      {t.via} {d.via.join(', ')}
    </>
  )
}

/** Track number with the letter as superscript (11ᵇ), like the track signs. */
function TrackNumber({ track }: { track: string }) {
  const m = track.match(/^(\d+)([a-z])$/i)
  if (!m) return <>{track || '-'}</>
  return (
    <>
      {m[1]}
      <sup>{m[2]}</sup>
    </>
  )
}

/**
 * Customs pictogram, after the NS "politie" pictogram: an officer (no holster) looking at an open passport in
 * his raised hand, as on the boards for the Eurostar to London. Drawn on a 64 grid; the white lines are cut out
 * with a mask so the icon works on any background.
 */
function CustomsIcon() {
  const id = useId()
  return (
    <svg className="ov-customs" viewBox="2.5 3 64 64" aria-label="Douane">
      <mask id={id}>
        <rect width="70" height="70" fill="#fff" />
        <g stroke="#000" strokeWidth="1.5">
          <path d="M14.25 41v19" strokeLinecap="round" />
          <path d="M31.5 30.5 14.25 52.5H34" />
        </g>
      </mask>
      <g mask={`url(#${id})`}>
        {/* Head and cap, turned up towards the passport. */}
        <g transform="rotate(-12 22 22)">
          <path d="M15.75 19a6.25 6.25 0 0 0 12.5 0z" />
          <path d="M14.5 13.2 22 10.2l7.5 3-1.3 2.6H15.8z" />
          <path d="M15.8 16.6h12.4l4.2.9-.5.9H15.8z" />
        </g>
        <path d="M8 60V37a7 7 0 0 1 7-7h16a7 7 0 0 1 6.06 3.5L33.5 40v20z" />
        <path d="M33.9 34.5 42.6 47.6 52.4 36.8" fill="none" stroke="currentColor" strokeWidth="6.4" strokeLinejoin="round" strokeLinecap="round" />
        {/* Open passport. */}
        <path d="M47 19.3l6.4 1.4v11.6L47 30.9zM54.6 20.7l6.4-1.4v11.6l-6.4 1.4z" />
      </g>
    </svg>
  )
}

function DestName({ name }: { name: string }) {
  const [ref, shown] = useFitName<HTMLSpanElement>(name)
  return (
    <span ref={ref} className="ov-dest-name">
      <Place name={shown} />
    </span>
  )
}

function Row({ d, t }: { d: Departure; t: Strings }) {
  const changed = d.track !== d.plannedTrack
  return (
    <div className={`ov-row${d.cancelled ? ' cancelled' : ''}`}>
      <div className="ov-time">{formatTime(d.planned)}</div>
      <div className="ov-dest">
        <DestName name={d.direction} />
        {isInternational(d) && (
          <span className="ov-train-number">
            {d.productShort.toUpperCase()} {d.number}
          </span>
        )}
      </div>
      <div className="ov-track">
        {needsCustoms(d) ? (
          <span className="customs">
            <CustomsIcon />
          </span>
        ) : (
          // A changed track is underlined.
          <span>
            <span className={changed ? 'changed' : undefined}>
              <TrackNumber track={d.track} />
            </span>
          </span>
        )}
      </div>
      <div className="ov-product">
        <ProductStack longName={d.productLong} operatorCode={d.operatorCode} operatorName={d.operatorName} />
      </div>
      <div className="ov-delay">{d.delayMin > 0 && `+${d.delayMin}`}</div>
      <div className="ov-sub">
        <SubLine d={d} t={t} />
      </div>
    </div>
  )
}

function ClockIcon() {
  return (
    <svg className="ov-clock" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <path d="M12 6v6.5l4 2.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

function OverviewScreen({ rows, t, pager, rowH }: { rows: Departure[]; t: Strings; pager?: string; rowH: number }) {
  const now = useNow()
  return (
    <div className="screen overview" style={{ '--ov-row-h': `${rowH}px` } as CSSProperties}>
      <div className="ov-head">
        {/* The header is always Dutch, as on the real boards. */}
        <div>{STRINGS_NL.departure}</div>
        <div>{STRINGS_NL.toRemarks}</div>
        <div className="ov-head-track">{STRINGS_NL.platform}</div>
        <div className="ov-head-time">
          <ClockIcon /> {formatTime(now)}
        </div>
      </div>
      {rows.map((d) => (
        <Row key={d.id} d={d} t={t} />
      ))}
      {pager && <div className="ov-pager">{pager}</div>}
    </div>
  )
}

/**
 * The departures overview for the whole station over `screens` screens side by side: the list runs on from
 * one screen to the next and pages when there are more trains than fit.
 */
export function useOverviewScreens({
  departures,
  lang,
  stale,
  loaded,
  screens,
  only = 0,
  rows = ROWS,
  height = 1080,
}: {
  departures: Departure[]
  lang: Lang
  stale: boolean
  loaded: boolean
  screens: number
  /** Show only this screen (1-based), e.g. one per TV; 0 = all. */
  only?: number
  /** Rows per screen and screen height (design pixels); the rows share the height. */
  rows?: number
  height?: number
}) {
  const t = useStrings(lang)
  const perPage = rows * screens
  const rowH = (height - HEAD_H - PAGER_H) / rows
  const pages = Math.max(1, Math.min(MAX_PAGES, Math.ceil(departures.length / perPage)))
  // Page from the clock, so separate screens (each on its own device) turn the page at the same moment.
  const now = useNow()
  const current = Math.floor(now.getTime() / PAGE_MS) % pages

  const indexes = only > 0 && only <= screens ? [only - 1] : Array.from({ length: screens }, (_, i) => i)
  return indexes.map((i) => {
    if (stale || (loaded && !departures.length)) return <NoDataScreen key={i} lang={lang} />
    const start = current * perPage + i * rows
    return (
      <OverviewScreen
        key={i}
        rows={departures.slice(start, start + rows)}
        rowH={rowH}
        t={t}
        pager={i === screens - 1 ? `${current + 1}/${pages}` : undefined}
      />
    )
  })
}
