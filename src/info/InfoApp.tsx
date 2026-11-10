import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { fetchStations } from '../lib/api'
import { DEFAULTS, readSettings, toQuery, type Settings } from '../lib/settings'
import type { Station } from '../lib/types'
import { NsLogo } from '../display/Product'
import { boardSize, overviewSize } from '../lib/board'

const SESSION_KEY = 'dris.settings'
const BASE = import.meta.env.BASE_URL

function initialSettings(): Settings {
  if (window.location.search) return readSettings(window.location.search)
  try {
    const saved = sessionStorage.getItem(SESSION_KEY)
    if (saved) return { ...DEFAULTS, ...JSON.parse(saved) }
  } catch {
    /* ignore */
  }
  return DEFAULTS
}

/* ---------- Building blocks ---------- */

/** Segmented control: a row of options of which one is on. */
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: [T, string][]
  onChange: (v: T) => void
}) {
  return (
    <div className="setting">
      <span className="setting-label">{label}</span>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map(([v, text]) => (
          <button key={v} type="button" role="radio" aria-checked={v === value} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Options as cards with a small drawing, for the choices that change the whole board. */
function Cards<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; title: string; icon: ReactNode }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="cards" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={`card-option${o.value === value ? ' on' : ''}`}
          onClick={() => onChange(o.value)}
        >
          <span className="card-icon">{o.icon}</span>
          <span className="card-title">{o.title}</span>
        </button>
      ))}
    </div>
  )
}

/** A numbered step of the settings. */
function Step({ n, title, children, aside }: { n: number; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="step">
      <header className="step-head">
        <span className="step-n">{n}</span>
        <h2>{title}</h2>
        {aside && <span className="step-aside">{aside}</span>}
      </header>
      <div className="step-body">{children}</div>
    </section>
  )
}

/* Small drawings for the cards (64 × 40). */
const Svg = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 64 40" aria-hidden>
    {children}
  </svg>
)
const ICONS = {
  single: (
    <Svg>
      <rect x="1" y="1" width="62" height="38" rx="3" className="i-screen" />
      <rect x="7" y="8" width="16" height="4" rx="1" className="i-line" />
      <rect x="7" y="15" width="36" height="7" rx="1" className="i-strong" />
      <rect x="7" y="25" width="28" height="3" rx="1" className="i-line" />
      <rect x="1" y="32" width="62" height="7" className="i-bar" />
    </Svg>
  ),
  double: (
    <Svg>
      <rect x="1" y="1" width="62" height="38" rx="3" className="i-screen" />
      <rect x="7" y="5" width="30" height="6" rx="1" className="i-strong" />
      <rect x="7" y="13" width="22" height="3" rx="1" className="i-line" />
      <rect x="1" y="19" width="62" height="3" className="i-bar" />
      <rect x="7" y="25" width="26" height="6" rx="1" className="i-strong" />
      <rect x="7" y="33" width="20" height="3" rx="1" className="i-line" />
    </Svg>
  ),
  overview: (
    <Svg>
      <rect x="1" y="1" width="62" height="38" rx="3" className="i-screen" />
      <rect x="1" y="1" width="62" height="6" className="i-bar" />
      {[11, 18, 25, 32].map((y) => (
        <g key={y}>
          <rect x="6" y={y} width="30" height="4" rx="1" className="i-strong" />
          <rect x="46" y={y - 1} width="6" height="6" className="i-sign" />
        </g>
      ))}
    </Svg>
  ),
  screen: (
    <Svg>
      <rect x="10" y="5" width="44" height="30" rx="2" className="i-screen" />
    </Svg>
  ),
  signs: (
    <Svg>
      <rect x="2" y="7" width="14" height="26" rx="2" className="i-housing" />
      <rect x="5" y="10" width="8" height="8" className="i-sign" />
      <rect x="18" y="7" width="44" height="26" rx="2" className="i-housing" />
      <rect x="21" y="10" width="38" height="20" className="i-screen" />
    </Svg>
  ),
  board: (
    <Svg>
      <rect x="1" y="9" width="10" height="22" rx="2" className="i-housing" />
      <rect x="3" y="11" width="6" height="6" className="i-sign" />
      <rect x="12" y="9" width="36" height="22" rx="2" className="i-housing" />
      <rect x="15" y="12" width="30" height="16" className="i-screen" />
      <rect x="49" y="9" width="14" height="22" rx="2" className="i-panel" />
      <circle cx="56" cy="20" r="5.5" className="i-clock" />
    </Svg>
  ),
  housing: (
    <Svg>
      <rect x="6" y="5" width="52" height="30" rx="2" className="i-housing" />
      <rect x="10" y="9" width="44" height="22" className="i-screen" />
    </Svg>
  ),
}

/** Tracks for the picker in natural order, with the plain number added where only 5a/5b exist ("5" shows both). */
function trackOptions(tracks: string[]): string[] {
  const set = new Set(tracks)
  for (const t of tracks) {
    const base = t.match(/^(\d+)[a-z]$/i)?.[1]
    if (base) set.add(base)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'nl', { numeric: true }))
}

/** Track picker: tiles styled like the track signs; the chosen one looks like the real sign. */
function TrackPicker({
  label,
  tracks,
  value,
  onChange,
  sameOption,
}: {
  label: string
  tracks: string[]
  value: string
  onChange: (t: string) => void
  /** Extra first tile for "same track as above" (value ''). */
  sameOption?: string
}) {
  // A track from a link that is not in the station's list (e.g. an old link) still shows as a tile.
  const list = value && !tracks.includes(value) ? [...tracks, value] : tracks
  return (
    <div className="setting">
      <span className="setting-label">{label}</span>
      <div className="tracks" role="radiogroup" aria-label={label}>
        {sameOption && (
          <button
            type="button"
            role="radio"
            aria-checked={value === ''}
            className={`track-tile same${value === '' ? ' on' : ''}`}
            onClick={() => onChange('')}
          >
            {sameOption}
          </button>
        )}
        {list.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={t === value}
            className={`track-tile${t === value ? ' on' : ''}`}
            title={
              /^\d+$/.test(t) && tracks.some((o) => o !== t && o.startsWith(t) && /^[a-z]$/i.test(o.slice(t.length)))
                ? `Spoor ${t} (alle delen)`
                : `Spoor ${t}`
            }
            onClick={() => onChange(t)}
          >
            <span>
              {t.replace(/^(\d+)([a-z])$/i, '$1')}
              {/^\d+[a-z]$/i.test(t) && <sup>{t.slice(-1)}</sup>}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Shape of the preview: the board's fixed proportions, or 16:9 for a single bare screen. */
function previewShape(s: Settings) {
  if (s.layout === 'overview' && s.frame === 'screen') {
    const { width, height } = overviewSize(s.screens)
    return { aspectRatio: `${width} / ${height}` }
  }
  if (s.frame === 'screen') return undefined
  const { width, height } = boardSize(s)
  return { aspectRatio: `${width} / ${height}` }
}

function CopyButton({ href, className = 'btn' }: { href: string; className?: string }) {
  const [done, setDone] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(new URL(href, window.location.href).toString())
    setDone(true)
    setTimeout(() => setDone(false), 1500)
  }
  return (
    <button type="button" className={className} onClick={copy}>
      {done ? 'Gekopieerd ✓' : 'Kopieer link'}
    </button>
  )
}

/* ---------- Page ---------- */

export function InfoApp() {
  const [s, setS] = useState<Settings>(initialSettings)
  const [stations, setStations] = useState<Station[]>([])
  const [stationError, setStationError] = useState('')
  const [query, setQuery] = useState(s.stationName)
  const [active, setActive] = useState(0) // highlighted suggestion

  const update = (patch: Partial<Settings>) => setS((prev) => ({ ...prev, ...patch }))

  useEffect(() => {
    fetchStations()
      .then(setStations)
      .catch((e) => setStationError(String(e.message ?? e)))
  }, [])

  useEffect(() => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s))
  }, [s])

  const station = stations.find((st) => st.code === s.station)
  useEffect(() => {
    if (station && !query) setQuery(station.name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [station])
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || (station && station.name === query)) return []
    return stations
      .filter((st) => st.name.toLowerCase().includes(q) || st.code.toLowerCase() === q)
      .sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)))
      .slice(0, 8)
  }, [query, stations, station])
  useEffect(() => setActive(0), [matches])

  const chooseStation = (st: Station) => {
    setQuery(st.name)
    update({
      station: st.code,
      stationName: st.name,
      track: trackOptions(st.tracks)[0] ?? '',
      track2: '',
    })
  }

  const overview = s.layout === 'overview'
  const ready = Boolean((s.station || s.mock) && (s.track || overview))
  const query_ = toQuery(s)
  const url = `${BASE}?${query_}`
  const absoluteUrl = new URL(url, window.location.href).toString()
  // Overview over several screens: a link per screen, for one device (TV, browser) per screen.
  const screenUrls = overview && s.screens > 1 ? Array.from({ length: s.screens }, (_, i) => `${BASE}?${toQuery({ ...s, screen: i + 1 })}`) : []

  const tracks = trackOptions(station?.tracks ?? [])
  const twoTracks = s.layout === 'double' && Boolean(s.track2) && s.track2 !== s.track

  // Summary above the preview, e.g. "Utrecht Centraal · spoor 8 en 9".
  const summary = [
    s.mock ? 'Demodata' : station?.name || s.stationName || 'Geen station',
    overview ? `overzicht${s.screens > 1 ? `, ${s.screens} schermen` : ''}` : s.track && `spoor ${s.track}${twoTracks ? ` en ${s.track2}` : ''}`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="info">
      <header className="info-header">
        <NsLogo className="info-logo" />
        <h1>DRIS</h1>
        <span className="info-version">versie {__DRIS_VERSION__}</span>
      </header>

      <main className="info-main">
        <form className="info-form" onSubmit={(e) => e.preventDefault()}>
          <Step n={1} title="Station" aside={station && <span className="station-code">{station.code}</span>}>
            <div className="station-field">
              <svg className="search-icon" viewBox="0 0 24 24" aria-hidden>
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="M15.5 15.5L21 21" />
              </svg>
              <input
                value={query}
                placeholder="Zoek een station, bijv. Utrecht Centraal"
                aria-label="Station"
                onChange={(e) => {
                  setQuery(e.target.value)
                  // Typing another name drops the chosen station, so the preview and links never show the old one.
                  if (s.station && e.target.value !== s.stationName) update({ station: '', stationName: '' })
                }}
                onKeyDown={(e) => {
                  if (!matches.length) return
                  if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, matches.length - 1))
                  else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0))
                  else if (e.key === 'Enter') chooseStation(matches[active] ?? matches[0])
                  else return
                  e.preventDefault()
                }}
                autoComplete="off"
              />
              {matches.length > 0 && (
                <ul className="suggestions" role="listbox">
                  {matches.map((st, i) => (
                    <li key={st.code}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={i === active}
                        className={i === active ? 'active' : ''}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => chooseStation(st)}
                      >
                        {st.name} <small>{st.code}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {stationError && <p className="error">Stations laden mislukt: {stationError}</p>}
          </Step>

          <Step n={2} title="Wat wil je tonen?">
            <Cards
              label="Indeling"
              value={s.layout}
              onChange={(layout) => update({ layout })}
              options={[
                { value: 'single', title: 'Eén trein', icon: ICONS.single },
                { value: 'double', title: 'Twee treinen', icon: ICONS.double },
                { value: 'overview', title: 'Overzicht', icon: ICONS.overview },
              ]}
            />
            {!overview && tracks.length === 0 && !s.track && <p className="hint">Kies eerst een station, dan verschijnen hier de sporen.</p>}
            {!overview && (tracks.length > 0 || s.track) && (
              <>
                <TrackPicker
                  label={s.layout === 'double' ? 'Bovenste trein' : 'Spoor'}
                  tracks={tracks}
                  value={s.track}
                  onChange={(track) => update({ track })}
                />
                {s.layout === 'double' && (
                  <TrackPicker
                    label="Onderste trein"
                    tracks={tracks.filter((t) => t !== s.track)}
                    value={s.track2 === s.track ? '' : s.track2}
                    onChange={(track2) => update({ track2 })}
                    sameOption={s.track ? `Ook spoor ${s.track}` : 'Zelfde spoor'}
                  />
                )}
                <p className="hint">
                  {s.layout === 'double' && !twoTracks
                    ? `De twee eerstvolgende treinen van spoor ${s.track || '…'} onder elkaar. Kies een ander spoor voor de onderste helft om twee sporen te tonen.`
                    : 'Een spoor zonder letter (bijv. 5) toont ook 5a en 5b.'}
                </p>
              </>
            )}
            {overview && (
              <>
                <Segmented
                  label="Schermen naast elkaar"
                  value={String(s.screens)}
                  options={[
                    ['1', '1 scherm'],
                    ['2', '2 schermen'],
                    ['3', '3 schermen'],
                  ]}
                  onChange={(n) => update({ screens: Number(n) })}
                />
                <p className="hint">De lijst loopt door over de schermen: scherm 2 begint waar scherm 1 ophoudt.</p>
              </>
            )}
          </Step>

          <Step n={3} title="Uiterlijk">
            {overview ? (
              // The overview screens have no track signs or clock next to them.
              <Cards
                label="Weergave"
                value={s.frame === 'screen' ? 'screen' : 'signs'}
                onChange={(frame) => update({ frame })}
                options={[
                  { value: 'screen', title: 'Alleen scherm', icon: ICONS.screen },
                  { value: 'signs', title: 'In behuizing', icon: ICONS.housing },
                ]}
              />
            ) : (
              <Cards
                label="Weergave"
                value={s.frame}
                onChange={(frame) => update({ frame })}
                options={[
                  { value: 'screen', title: 'Alleen scherm', icon: ICONS.screen },
                  { value: 'signs', title: 'Met spoorbord', icon: ICONS.signs },
                  { value: 'board', title: 'Met spoorbord en klok', icon: ICONS.board },
                ]}
              />
            )}
            <div className="settings-grid">
              {!overview && s.frame !== 'screen' && (
                <Segmented
                  label="Spoorbord"
                  value={s.side}
                  options={[
                    ['left', 'Links'],
                    ['right', 'Rechts'],
                  ]}
                  onChange={(side) => update({ side })}
                />
              )}
              {!overview && s.frame === 'board' && (
                <Segmented
                  label="Klok"
                  value={s.clock}
                  options={[
                    ['square', 'Vierkant'],
                    ['center', 'Smal, midden'],
                    ['top', 'Smal, boven'],
                  ]}
                  onChange={(clock) => update({ clock })}
                />
              )}
              <Segmented
                label="Kleuren"
                value={s.theme}
                options={[
                  ['dark', 'Donker (nieuw)'],
                  ['light', 'Licht (klassiek)'],
                ]}
                onChange={(theme) => update({ theme })}
              />
              <Segmented
                label="Taal"
                value={s.lang}
                options={[
                  ['alt', 'NL / EN'],
                  ['nl', 'Nederlands'],
                  ['en', 'English'],
                ]}
                onChange={(lang) => update({ lang })}
              />
            </div>
          </Step>

          <label className="switch">
            <input type="checkbox" checked={s.mock} onChange={(e) => update({ mock: e.target.checked })} />
            <span className="switch-track" aria-hidden />
            <span className="switch-text">
              Demodata gebruiken
              <small>{s.mock ? 'Vaste voorbeeldtreinen, bij elk station hetzelfde.' : 'Uit: live vertrektijden van NS.'}</small>
            </span>
          </label>
        </form>

        <aside className="preview">
          <div className="preview-head">
            <h2>Voorbeeld</h2>
            <span className={`preview-summary${s.mock ? ' demo' : ''}`}>{summary}</span>
          </div>
          <div className={`preview-frame ${s.frame}`} style={previewShape(s)}>
            {ready ? <iframe key={query_} src={url} title="Voorbeeld" /> : <p>{overview ? 'Kies een station.' : 'Kies een station en spoor.'}</p>}
          </div>

          <div className="actions">
            <a className={`btn primary${ready ? '' : ' disabled'}`} href={ready ? url : undefined}>
              Open scherm
            </a>
            <a className={`btn${ready ? '' : ' disabled'}`} href={ready ? url : undefined} target="_blank" rel="noreferrer">
              Nieuw venster
            </a>
            {ready && <CopyButton href={absoluteUrl} />}
          </div>
          {ready && <code className="url">{absoluteUrl}</code>}

          {ready && screenUrls.length > 0 && (
            <div className="screen-links">
              <h3>Elk scherm op een eigen apparaat</h3>
              {screenUrls.map((href, i) => (
                <div key={href} className="screen-link">
                  <span>Scherm {i + 1}</span>
                  <a className="btn small" href={href} target="_blank" rel="noreferrer">
                    Openen
                  </a>
                  <CopyButton href={href} className="btn small" />
                </div>
              ))}
              <p className="hint">De schermen bladeren tegelijk door, ook op verschillende apparaten (mits hun klok gelijk loopt).</p>
            </div>
          )}

          <p className="hint keys">
            Op het scherm: dubbelklik of <kbd>f</kbd> voor volledig scherm, <kbd>i</kbd> om hier terug te komen.
          </p>
        </aside>
      </main>
    </div>
  )
}
