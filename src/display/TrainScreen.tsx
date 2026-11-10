import type { JourneyStop } from '../lib/journey'
import type { Lang, TrainScreenKind } from '../lib/settings'
import { formatTime, useBeat } from '../lib/text'
import type { Material, TrainData } from '../lib/useTrainData'
import { useNameVariants } from '../lib/stationNames'
import { NsLogo } from './Product'

/** Design size of the train screen (16:9, like the screens in the VIRM, ICM and DDZ). */
export const TRAIN_W = 1280
export const TRAIN_H = 720
/** Black bezel around the screen in the housing view. */
export const TRAIN_BEZEL = 46

/** The SLT (Sprinter Lighttrain) has smaller, 4:3 screens in a silver housing. */
export const SLT_W = 1024
export const SLT_H = 768
export const SLT_BEZEL = 52
/** The new screens (16:9 as well) have a thin bezel. */
export const MODERN_BEZEL = 30

export type ScreenKind = 'obis' | 'slt' | 'modern'

/** Rolling stock with the new screens (photos of SNG, FLIRT and ICNG all show the same design). */
const MODERN = /^(SNG|FLIRT|ICNG)/

/** Which screen to draw: the chosen one, or (auto) the SLT screen only when the train really is an SLT. */
export function screenKind(choice: TrainScreenKind, material: Pick<Material, 'type'> | string | null | undefined): ScreenKind {
  if (choice !== 'auto') return choice
  const type = typeof material === 'string' ? material : material?.type
  if (type?.startsWith('SLT')) return 'slt'
  return type && MODERN.test(type) ? 'modern' : 'obis'
}

export function trainSize(housing: boolean, kind: ScreenKind = 'obis') {
  const [w, h, bezel] =
    kind === 'slt' ? [SLT_W, SLT_H, SLT_BEZEL] : [TRAIN_W, TRAIN_H, kind === 'modern' ? MODERN_BEZEL : TRAIN_BEZEL]
  const pad = housing ? bezel * 2 : 0
  return { width: w + pad, height: h + pad }
}

const STRINGS = {
  nl: {
    to: 'naar',
    expected: 'Verwachte aankomsttijd:',
    onTime: 'Op tijd',
    platform: 'Spoor:',
    change: 'U kunt hier overstappen voor de richting:',
    terminus: 'Eindpunt van deze trein',
    noData: 'Geen reisinformatie beschikbaar',
    noTrain: 'Wachten op de volgende trein',
    nextStation: 'Het volgende station:',
    thisStation: 'Dit is station:',
    welcome: 'Welkom in de Sprinter naar:',
    nextPlain: 'Volgend station',
    herePlain: 'Dit is station',
    arrival: 'Aankomst',
    departure: 'Vertrek',
    changeTo: 'Overstap naar',
  },
  en: {
    to: 'to',
    expected: 'Expected arrival time:',
    onTime: 'On time',
    platform: 'Platform:',
    change: 'You can change here for:',
    terminus: 'This train terminates here',
    noData: 'No travel information available',
    noTrain: 'Waiting for the next train',
    nextStation: 'Next station:',
    thisStation: 'This is:',
    welcome: 'Welcome to the Sprinter to:',
    nextPlain: 'Next station',
    herePlain: 'This is',
    arrival: 'Arrival',
    departure: 'Departure',
    changeTo: 'Change for',
  },
}

/** The longest NS name for the station that fits in `max` characters ("Amsterdam Bijlmer ArenA" → "A'dam Bijlmer A"). */
function Name({ name, max }: { name: string; max: number }) {
  const variants = useNameVariants(name)
  return <>{variants.find((v) => v.length <= max) ?? variants[variants.length - 1]}</>
}

const time = (s: JourneyStop) => formatTime((s.arrival ?? s.departure)!)

export function TrainScreen({ data, lang, hasSource }: { data: TrainData; lang: Lang; hasSource: boolean }) {
  const beat = useBeat()
  const t = STRINGS[lang === 'en' || (lang === 'alt' && beat % 2 === 1) ? 'en' : 'nl']
  const { journey, view, now } = data

  const header = (
    <header className="ts-head">
      <NsLogo className="ts-logo" />
      {journey && (
        <span className="ts-title">
          <b className="ts-product">{journey.productShort}</b> {t.to}{' '}
          <b>
            <Name name={journey.destination} max={26} />
          </b>
        </span>
      )}
      <span className="ts-clock">{formatTime(now)}</span>
    </header>
  )

  if (!journey || !view) {
    const message = !hasSource || (data.loaded && !data.stale) ? t.noTrain : data.loaded ? t.noData : ''
    return (
      <div className="train-screen">
        {header}
        <section className="ts-panel">
          <p className="ts-label">{message}</p>
        </section>
        <section className="ts-lower" />
      </div>
    )
  }

  const next = view.next
  const delay = next.delayMin
  const arriving = view.kind === 'arriving'
  const atEnd = view.kind === 'terminus' || view.kind === 'ended'
  const transfers = arriving ? data.connections : []

  return (
    <div className="train-screen">
      {header}
      <section className="ts-panel">
        <p className="ts-label">{t.expected}</p>
        <p className="ts-next">
          <span className="ts-next-time">{time(next)}</span>
          <span className="ts-next-name">
            <Name name={next.name} max={22} />
          </span>
        </p>
        <p className="ts-status">
          {delay > 0 ? <span className="ts-late">+{delay} min</span> : <span className="ts-ontime">{t.onTime}</span>}
          {(arriving || atEnd) && next.track && (
            <span className="ts-track">
              {t.platform}
              <span className="ts-track-n">{next.track}</span>
            </span>
          )}
        </p>
      </section>
      <section className="ts-lower">
        {atEnd ? (
          <p className="ts-note">{t.terminus}</p>
        ) : transfers.length > 0 ? (
          <>
            <p className="ts-note">{t.change}</p>
            <ul className="ts-transfers">
              {transfers.map((d) => (
                <li key={d.id}>
                  <span className="ts-time">{formatTime(d.actual)}</span>
                  <span className="ts-dir">
                    <Name name={d.direction} max={24} />
                  </span>
                  <span className="ts-tr-track">{d.track}</span>
                  <span className="ts-tr-product">{d.productShort}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <ul className="ts-route" style={{ ['--rows' as string]: view.later.length }}>
            {view.later.map((s, i) => (
              <li key={s.code} className={i === view.later.length - 1 ? 'last' : ''}>
                <span className="ts-time">{time(s)}</span>
                <span className="ts-dot" />
                <span className="ts-stop">
                  <Name name={s.name} max={28} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/** The clock pictogram in the title bar of the SLT screen. */
function ClockIcon() {
  return (
    <svg className="slt-clock-icon" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <path d="M12 5.5V12h5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

/**
 * The screen in the SLT (Sprinter Lighttrain): 4:3, a blue title bar, a light field with only the next
 * station in the middle, and a blue bottom bar with the number of the train unit. Older look, Arial-like font.
 */
export function SltScreen({ data, lang, hasSource }: { data: TrainData; lang: Lang; hasSource: boolean }) {
  const beat = useBeat()
  const t = STRINGS[lang === 'en' || (lang === 'alt' && beat % 2 === 1) ? 'en' : 'nl']
  const { journey, view, now } = data
  const message = !hasSource || (data.loaded && !data.stale) ? t.noTrain : data.loaded ? t.noData : ''
  return (
    <div className="slt-screen">
      <header className="slt-head">
        <NsLogo className="slt-logo" />
        {journey && (
          <span className="slt-title">
            {journey.productShort} <small>{t.to}</small> <Name name={journey.destination} max={24} />
          </span>
        )}
        <span className="slt-clock">
          <ClockIcon />
          {formatTime(now)}
        </span>
      </header>
      <section className="slt-body">
        {journey && view ? (
          (() => {
            const t0 = now.getTime()
            const first = journey.stops[0]
            // Before the departure from the first stop: welcome, with the destination.
            if (first?.departure && t0 < first.departure.getTime())
              return (
                <>
                  <p className="slt-label">{t.welcome}</p>
                  <p className="slt-next">
                    <b>
                      <Name name={journey.destination} max={20} />
                    </b>
                  </p>
                </>
              )
            // Standing at a stop (or arrived at the last one): "Dit is station:", without a time.
            const here = view.next.arrival && t0 >= view.next.arrival.getTime()
            if (here || view.kind === 'ended')
              return (
                <>
                  <p className="slt-label">{view.kind === 'ended' ? t.terminus : t.thisStation}</p>
                  <p className="slt-next">
                    <b>
                      <Name name={view.next.name} max={20} />
                    </b>
                  </p>
                </>
              )
            return (
              <>
                <p className="slt-label">{t.nextStation}</p>
                <p className="slt-next">
                  <span className="slt-time">{time(view.next)}</span>
                  <b>
                    <Name name={view.next.name} max={20} />
                  </b>
                </p>
              </>
            )
          })()
        ) : (
          <p className="slt-label">{message}</p>
        )}
      </section>
      <footer className="slt-foot">{data.material?.unit}</footer>
    </div>
  )
}

/** The screen in its housing as it hangs in the train: black for OBIS, silver for the SLT, a thin black
 *  bezel in a grey frame for the new screens. */
export function TrainHousing({ kind = 'obis', children }: { kind?: ScreenKind; children: React.ReactNode }) {
  return (
    <div className={`train-housing ${kind}`} style={{ padding: kind === 'slt' ? SLT_BEZEL : kind === 'modern' ? MODERN_BEZEL : TRAIN_BEZEL }}>
      <div className="train-housing-screen">{children}</div>
      {kind === 'obis' && <span className="train-housing-led" />}
    </div>
  )
}

/* ---------- The new screens (SNG, FLIRT, ICNG) ---------- */

/** Track sign as on the new screens: always a square with a small filled corner; longer tracks ("4b", "1-2")
 *  get smaller text instead of a wider box. */
function TrackBox({ track }: { track: string }) {
  if (!track) return null
  const scale = track.length <= 1 ? 1 : track.length === 2 ? 0.78 : 0.6
  return (
    <span className="nw-track">
      <span style={{ fontSize: `${scale}em` }}>{track}</span>
    </span>
  )
}

/** Planned time and the delay in red behind it ("15:03+2"), as on the new screens. */
function PlannedTime({ planned, delay }: { planned?: Date; delay: number }) {
  if (!planned) return null
  return (
    <>
      {formatTime(planned)}
      {delay > 0 && <span className="nw-delay">+{delay}</span>}
    </>
  )
}

function Warning() {
  return (
    <svg className="nw-warn" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 3 22 20H2Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 9.5v5M12 16.6v1.4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

/**
 * The new design (SNG, FLIRT, ICNG): blue head with "Sprinter naar" and the destination, a light band with the
 * next stop (or the stop the train stands at) with time and track, and below it the next stops along a line,
 * the connections or "Eindpunt van deze trein".
 */
export function ModernScreen({ data, lang, hasSource }: { data: TrainData; lang: Lang; hasSource: boolean }) {
  const beat = useBeat()
  const t = STRINGS[lang === 'en' || (lang === 'alt' && beat % 2 === 1) ? 'en' : 'nl']
  const { journey, view, now } = data

  const head = (
    <header className="nw-head">
      <span className="nw-clock">{formatTime(now)}</span>
      {journey && (
        <>
          <p className="nw-product">
            {journey.productLong} {t.to}
          </p>
          <p className="nw-dest">
            <Name name={journey.destination} max={21} />
          </p>
        </>
      )}
    </header>
  )

  if (!journey || !view) {
    const message = !hasSource || (data.loaded && !data.stale) ? t.noTrain : data.loaded ? t.noData : ''
    return (
      <div className="nw-screen">
        {head}
        <section className="nw-band">
          <p className="nw-label">{message}</p>
        </section>
        <section className="nw-lower" />
      </div>
    )
  }

  const stops = journey.stops
  const ms = now.getTime()
  const first = stops[0]
  // Before the departure from the first stop the train stands there (the view already points at the stop after it).
  const atStart = first?.departure && ms < first.departure.getTime() && view.next !== first
  const stop = atStart ? first : view.next
  const standing = atStart || view.kind === 'ended' || Boolean(stop.arrival && ms >= stop.arrival.getTime())
  const isLast = stop === stops[stops.length - 1]
  const showDeparture = standing && !isLast
  const transfers = !standing && view.kind === 'arriving' ? data.connections : []
  // The stops after this one, without the destination (it is in the head already).
  const after = stops.slice(stops.indexOf(stop) + 1, -1).slice(0, 4)
  const route = !isLast && transfers.length === 0 && after.length > 0

  return (
    <div className="nw-screen">
      {head}
      <section className={`nw-band${route ? ' down' : ''}${isLast ? ' up' : ''}`}>
        <div className="nw-where">
          <p className="nw-label">{standing ? t.herePlain : t.nextPlain}</p>
          <p className="nw-name">
            <span className="nw-ring" />
            <Name name={stop.name} max={13} />
          </p>
        </div>
        {!(standing && isLast) && (
          <div className="nw-when">
            <p className="nw-label">{showDeparture ? t.departure : t.arrival}</p>
            <p className="nw-time">
              <span>
                {showDeparture ? (
                  <PlannedTime planned={stop.plannedDeparture ?? stop.departure} delay={delayAt(stop.plannedDeparture, stop.departure)} />
                ) : (
                  <PlannedTime planned={stop.plannedArrival ?? stop.arrival} delay={stop.delayMin} />
                )}
              </span>
              <TrackBox track={stop.track} />
            </p>
          </div>
        )}
      </section>
      <section className="nw-lower">
        {isLast ? (
          <p className="nw-note">
            <Warning />
            {t.terminus}
          </p>
        ) : transfers.length > 0 ? (
          <>
            <p className="nw-sub">{t.changeTo}</p>
            <ul className="nw-transfers">
              {transfers.map((d) => (
                <li key={d.id}>
                  <span className="nw-tr-time">
                    <PlannedTime planned={d.planned} delay={d.delayMin} />
                  </span>
                  <b className="nw-tr-dir">
                    <Name name={d.direction} max={22} />
                  </b>
                  <span className="nw-tr-product">{d.productLong}</span>
                  <TrackBox track={d.track} />
                </li>
              ))}
            </ul>
          </>
        ) : (
          route && (
            <ul className="nw-route">
              {after.map((s, i) => (
                <li key={s.code}>
                  <Name name={s.name} max={24} />
                  {i < after.length - 1 && ','}
                </li>
              ))}
            </ul>
          )
        )}
      </section>
    </div>
  )
}

/** Delay in whole minutes between a planned and an actual time (0 when on time or early). */
function delayAt(planned?: Date, actual?: Date): number {
  if (!planned || !actual) return 0
  return Math.max(0, Math.round((actual.getTime() - planned.getTime()) / 60_000))
}
