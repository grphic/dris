import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { Lang } from '../lib/settings'
import { COUNTDOWN_FROM_MIN, STRINGS_EN, STRINGS_NL, formatTime, useNow, useStrings, type Strings } from '../lib/text'
import { useNameVariants } from '../lib/stationNames'
import type { Departure } from '../lib/types'
import type { Slot } from '../lib/useBoardData'
import { Product } from './Product'
import { TrainGraphic } from './TrainGraphic'

/** Board texts in English are shown in italics, like on the real boards. */
export function Tr({ t, children }: { t: Strings; children: ReactNode }) {
  return t.en ? <i className="en">{children}</i> : <>{children}</>
}

const AIRPORT = /schiphol|airport|flughafen|luchthaven|zaventem/i

/** Airplane pictogram (as shown after "Schiphol Airport"). */
export function Plane() {
  return (
    <svg className="plane" viewBox="0 0 24 24" aria-label="luchthaven">
      <path
        fill="currentColor"
        d="M21.5 15.6v-1.9L13.6 9V3.6c0-.9-.7-1.6-1.6-1.6s-1.6.7-1.6 1.6V9l-7.9 4.7v1.9l7.9-2.4v5.2l-2.2 1.6V22L12 21l3.8 1v-1.9l-2.2-1.6v-5.2z"
      />
    </svg>
  )
}

/** Station name, followed by an airplane for airport stations. */
export function Place({ name }: { name: string }) {
  return (
    <>
      {name}
      {AIRPORT.test(name) && (
        <>
          {' '}
          <Plane />
        </>
      )}
    </>
  )
}

/**
 * A station name that falls back to a shorter form when the full one does not fit its box (the element the
 * returned ref goes on, with overflow hidden); the ellipsis is only the last resort. Measured before paint,
 * so the long form never flashes.
 */
export function useFitName<T extends HTMLElement>(name: string) {
  const ref = useRef<T>(null)
  const variants = useNameVariants(name)
  const [width, setWidth] = useState(0)
  const [fit, setFit] = useState({ key: '', i: 0 })
  const key = `${variants.join('|')}|${width}`
  const i = fit.key === key ? fit.i : 0

  // Start over from the full name when the space changes (the box's parent sets the width) or fonts load.
  useLayoutEffect(() => {
    const parent = ref.current?.parentElement
    if (!parent) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)))
    ro.observe(parent)
    document.fonts?.ready.then(() => setWidth((w) => w + 0.001))
    return () => ro.disconnect()
  }, [])

  useLayoutEffect(() => {
    const el = ref.current
    if (el && i < variants.length - 1 && el.scrollWidth > el.clientWidth + 1) setFit({ key, i: i + 1 })
  })
  return [ref, variants[Math.min(i, variants.length - 1)]] as const
}

/** "A, B, C en D", with the airplane after airport stations. */
function ViaList({ list, and }: { list: string[]; and: string }) {
  return (
    <>
      {list.map((name, i) => (
        <span key={name}>
          {i > 0 && (i === list.length - 1 ? ` ${and} ` : ', ')}
          <span className="via-name">
            <Place name={name} />
          </span>
        </span>
      ))}
    </>
  )
}

const STEP_MS = 3000 // time each position is shown
const END_MS = 5000 // extra pause on the last lines before jumping back to the top

/**
 * Shows `lines` lines of text. When the text is longer it moves up one line at a time, pauses at the end
 * and jumps back to the start, like the real boards do with long via lists.
 */
function LineScroller({ lines, className, contentKey, children }: { lines: number; className: string; contentKey: string; children: ReactNode }) {
  const inner = useRef<HTMLDivElement>(null)
  const [geo, setGeo] = useState({ lh: 0, total: 0 })
  const [step, setStep] = useState(0)

  // Measure in layout pixels (offsetHeight ignores the scale transform of the canvas).
  useLayoutEffect(() => {
    const el = inner.current
    if (!el) return
    const measure = () => {
      const lh = parseFloat(getComputedStyle(el).lineHeight) || 1
      setGeo({ lh, total: Math.round(el.offsetHeight / lh) })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const maxStep = Math.max(0, geo.total - lines)
  useEffect(() => setStep(0), [contentKey, maxStep])
  useEffect(() => {
    if (!maxStep) return
    const id = setTimeout(() => setStep((v) => (v >= maxStep ? 0 : v + 1)), step >= maxStep ? STEP_MS + END_MS : STEP_MS)
    return () => clearTimeout(id)
  }, [step, maxStep])

  return (
    <div className={`${className} scroller`} style={{ height: geo.lh ? geo.lh * lines : undefined }}>
      <div
        ref={inner}
        className="scroller-inner"
        style={{ transform: `translateY(${-step * geo.lh}px)`, transition: step ? 'transform 600ms ease-in-out' : 'none' }}
      >
        {children}
      </div>
    </div>
  )
}

/** A message in the board's current language: the English version (italic) when available, else Dutch. */
function Message({ list, en, i, t }: { list: string[]; en?: string[]; i: number; t: Strings }) {
  return t.en && en ? <i className="en">{en[i]}</i> : <>{list[i]}</>
}

function When({ d, now }: { d: Departure; now: Date }) {
  const ms = d.actual.getTime() - now.getTime()
  const mins = Math.ceil(ms / 60000)
  if (!d.cancelled && ms >= -30_000 && mins <= COUNTDOWN_FROM_MIN) {
    const less = ms < 60_000
    const n = Math.max(mins, 1)
    return (
      <span className="when">
        {less ? STRINGS_NL.lessThan1 : n} {/* Always Dutch: on the real boards only the "next train" bar is translated. */}
        <span className="when-unit">{less || n === 1 ? STRINGS_NL.min1 : STRINGS_NL.minN}</span>
      </span>
    )
  }
  return (
    <span className="when">
      {formatTime(d.planned)}
      {d.delayMin > 0 && <span className="delay"> +{d.delayMin}</span>}
    </span>
  )
}

function NextLine({ d, t, keep }: { d?: Departure; t: Strings; keep: boolean }) {
  // No later train on this track (e.g. late at night): leave the bar out instead of an empty band.
  // In the double layout an empty bar is kept so both halves stay the same height.
  if (!d && !keep) return null
  return (
    <div className="next-bar">
      {d && (
        // In English the whole bar is italic.
        <Tr t={t}>
          {t.next}: {formatTime(d.planned)}
          {d.delayMin > 0 && ` +${d.delayMin}`} {d.productShort} <Place name={d.direction} />
          {d.cancelled && <span className="next-cancelled">: {t.cancelled.toLowerCase()}</span>}
        </Tr>
      )}
    </div>
  )
}

/** A cancellation message from NS (not "Rijdt niet verder dan …", which is a shortened route). */
const CANCEL_MESSAGE = /^rijdt niet(?! verder)/i

function Destination({ d }: { d: Departure }) {
  const [ref, name] = useFitName<HTMLDivElement>(d.direction)
  return (
    <div ref={ref} className={`destination${d.cancelled ? ' struck' : ''}`}>
      {d.originalDirection && <s className="original">{d.originalDirection}</s>}
      {d.originalDirection && ' '}
      <Place name={name} />
    </div>
  )
}

function Section({ slot, t, compact }: { slot: Slot; t: Strings; compact: boolean }) {
  const now = useNow()
  const d = slot.current
  if (!d) return <div className="section empty" />
  // NS usually sends the full reason ("Rijdt niet door …"); only show our own "Rijdt niet" when it doesn't.
  const ownCancelled = d.cancelled && !d.warnings.some((w) => CANCEL_MESSAGE.test(w))
  return (
    <div className={`section${compact ? ' compact' : ''}`}>
      <div className="section-body">
        <div className="row-top">
          <When d={d} now={now} />
          <Product longName={d.productLong} operatorCode={d.operatorCode} operatorName={d.operatorName} />
        </div>
        <div className="destination-row">
          <Destination d={d} />
          {d.viaHighlight && (
            <span className="via-pill">
              {t.via} <Place name={d.viaHighlight} />
            </span>
          )}
        </div>
        {(ownCancelled || d.warnings.length > 0) && (
          <div className="warnings">
            {ownCancelled && <div className="warning">{STRINGS_NL.cancelled}</div>}
            {d.warnings.map((w, i) => (
              <div key={w} className="warning">
                <Message list={d.warnings} en={d.warningsEn} i={i} t={t} />
              </div>
            ))}
          </div>
        )}
        {d.via.length > 0 && (
          <LineScroller className="via" lines={compact ? 1 : 2} contentKey={d.id}>
            {t.via} <ViaList list={d.via} and={t.and} />
          </LineScroller>
        )}
        {!compact && !d.cancelled && (
          <div className="train-row">
            <TrainGraphic composition={slot.composition} />
          </div>
        )}
      </div>
      {!compact &&
        d.infos.map((info, i) => (
          <div key={info} className="info-bar">
            {/* Whole bar italic in English (Dutch text if there is no translation). */}
            <Tr t={t}>{t.en && d.infosEn ? d.infosEn[i] : info}</Tr>
          </div>
        ))}
      <NextLine d={slot.next} t={t} keep={compact} />
    </div>
  )
}

/** "No departure information", in both languages at once (English in italics). */
export function NoDataScreen({ lang }: { lang: Lang }) {
  return (
    <div className="screen">
      <div className="screen-message">
        {lang !== 'en' && <div className="msg-nl">{STRINGS_NL.noData}</div>}
        {lang !== 'nl' && <i className="msg-en">{STRINGS_EN.noData}</i>}
      </div>
    </div>
  )
}

export function Screen({ slots, lang, stale, loaded }: { slots: Slot[]; lang: Lang; stale: boolean; loaded: boolean }) {
  const t = useStrings(lang)
  if (stale || (loaded && slots.every((sl) => !sl.current))) return <NoDataScreen lang={lang} />
  const compact = slots.length > 1
  return (
    <div className={`screen${compact ? ' double' : ''}`}>
      {slots.map((s, i) => (
        <Fragment key={i}>
          {i > 0 && <div className="screen-split" />}
          <Section slot={s} t={t} compact={compact} />
        </Fragment>
      ))}
    </div>
  )
}
