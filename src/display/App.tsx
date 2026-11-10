import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { boardSize, hasTwoSigns, overviewSize } from '../lib/board'
import { readSettings, toQuery } from '../lib/settings'
import { useBoardData } from '../lib/useBoardData'
import { useTrainData } from '../lib/useTrainData'
import type { Departure } from '../lib/types'
import type { Settings } from '../lib/settings'
import { Clock } from './Clock'
import { ROWS, rowsFor, useOverviewScreens } from './Overview'
import { Screen } from './Screen'
import { TrackSign } from './TrackSign'
import { ModernScreen, SltScreen, TrainHousing, TrainScreen, screenKind, trainSize } from './TrainScreen'

interface Viewport {
  w: number
  h: number
}

/** Narrowest overview screen (design pixels): room for time, destination, track and product. */
const OV_MIN_W = 1400

function useViewport(): Viewport {
  const [vp, setVp] = useState<Viewport>({ w: window.innerWidth, h: window.innerHeight })
  useLayoutEffect(() => {
    const update = () =>
      setVp((v) => (v.w === window.innerWidth && v.h === window.innerHeight ? v : { w: window.innerWidth, h: window.innerHeight }))
    // Safari reports the size during the fullscreen animation (and sometimes while a window is being
    // resized), so the final size can come without another resize event: measure again once it settles.
    const timers: number[] = []
    const settle = () => {
      update()
      timers.push(window.setTimeout(update, 150), window.setTimeout(update, 600))
    }
    window.addEventListener('resize', settle)
    document.addEventListener('fullscreenchange', settle)
    window.visualViewport?.addEventListener('resize', settle)
    return () => {
      window.removeEventListener('resize', settle)
      document.removeEventListener('fullscreenchange', settle)
      window.visualViewport?.removeEventListener('resize', settle)
      timers.forEach(clearTimeout)
    }
  }, [])
  return vp
}

/**
 * Scales a design canvas (in design pixels) to the window.
 * Default: the canvas is at least minWidth × minHeight and grows in the other direction to fill the window.
 * fixed: the canvas is exactly minWidth × minHeight (black bars where the window has another shape).
 */
function Fit({
  vp,
  minWidth,
  minHeight,
  fixed = false,
  children,
}: {
  vp: Viewport
  minWidth: number
  minHeight: number
  fixed?: boolean
  children: ReactNode
}) {
  const scale = Math.min(vp.w / minWidth, vp.h / minHeight)
  const width = fixed ? minWidth : vp.w / scale
  const height = fixed ? minHeight : vp.h / scale
  return (
    <div className="fit">
      <div className="fit-canvas" style={{ width, height, transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  )
}

// True when this screen is the preview iframe on the settings page (same origin). In any other
// frame (e.g. a Home Assistant card, another origin) reading the parent's location throws: false.
function inSettingsPreview(): boolean {
  if (window.parent === window) return false
  try {
    return window.parent.location.pathname.startsWith(`${import.meta.env.BASE_URL}info`)
  } catch {
    return false
  }
}

export function App() {
  const settings = readSettings(window.location.search)
  const data = useBoardData(settings)
  const vp = useViewport()
  // Overview, bare screens in one window: responsive, filling the window (taller window = more rows).
  // A single screen of a row on its own device (scherm=…) stays 16:9 with 7 rows, so the list continues
  // correctly from one device to the next.
  const ovCount = settings.screen > 0 ? 1 : settings.screens
  const ovResponsive = settings.layout === 'overview' && settings.frame === 'screen' && !settings.screen
  const ovMin = { w: ovCount * OV_MIN_W + (ovCount - 1) * overviewSize(1).gap, h: overviewSize(1).height }
  const ovHeight = ovResponsive ? vp.h / Math.min(vp.w / ovMin.w, vp.h / ovMin.h) : ovMin.h
  const overview = useOverviewScreens({
    ...data,
    lang: settings.lang,
    screens: settings.layout === 'overview' ? settings.screens : 0,
    only: settings.screen,
    rows: ovResponsive ? rowsFor(ovHeight) : ROWS,
    height: ovHeight,
  })
  const hideCursor = useRef<number>(0)

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
  }, [settings.theme])

  // Demo data: mark every screen as a test screen (yellow line + TEST tab), like the real boards in test mode.
  useEffect(() => {
    if (settings.mock) document.documentElement.dataset.test = ''
    else delete document.documentElement.dataset.test
  }, [settings.mock])

  // Double click / "f" toggles fullscreen; "i" opens the settings page with these settings.
  // In the preview on the settings page, fullscreen applies to the preview frame (the settings page
  // stays underneath) and "i" just leaves fullscreen: you already are on the settings page.
  useEffect(() => {
    const dbl = () => {
      const preview = inSettingsPreview()
      const doc = preview ? window.parent.document : document
      const target = preview ? window.frameElement : document.documentElement
      if (doc.fullscreenElement) doc.exitFullscreen().catch(() => {})
      else target?.requestFullscreen().catch(() => {})
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'f') dbl()
      if (e.key !== 'i') return
      if (inSettingsPreview()) {
        if (window.parent.document.fullscreenElement) window.parent.document.exitFullscreen().catch(() => {})
      } else window.location.href = `${import.meta.env.BASE_URL}info/?${toQuery(settings)}`
    }
    const move = () => {
      document.body.classList.remove('hide-cursor')
      clearTimeout(hideCursor.current)
      hideCursor.current = window.setTimeout(() => document.body.classList.add('hide-cursor'), 3000)
    }
    window.addEventListener('dblclick', dbl)
    window.addEventListener('keydown', key)
    window.addEventListener('mousemove', move)
    move()
    return () => {
      window.removeEventListener('dblclick', dbl)
      window.removeEventListener('keydown', key)
      window.removeEventListener('mousemove', move)
    }
  }, [])

  if (!settings.station && !settings.mock && !(settings.layout === 'train' && settings.train)) {
    window.location.replace(`${import.meta.env.BASE_URL}info/`)
    return null
  }

  if (settings.layout === 'train') return <TrainApp settings={settings} departures={data.departures} vp={vp} />

  if (settings.layout === 'overview') {
    // Screens only, no track signs or clock: bare, or each in its housing.
    const count = overview.length
    if (ovResponsive) {
      return (
        <Fit vp={vp} minWidth={ovMin.w} minHeight={ovMin.h}>
          <div className="screens" style={{ gap: overviewSize(1).gap }}>
            {overview}
          </div>
        </Fit>
      )
    }
    if (settings.frame === 'screen') {
      const { width, height, gap } = overviewSize(count)
      return (
        <Fit vp={vp} minWidth={width} minHeight={height} fixed>
          <div className="screens" style={{ gap }}>
            {overview}
          </div>
        </Fit>
      )
    }
    const { width, height, vars } = boardSize({ ...settings, screens: count })
    return (
      <Fit vp={vp} minWidth={width} minHeight={height} fixed>
        <div className="board" style={vars}>
          {overview.map((sc, i) => (
            <div key={i} className="board-screen">
              <div className="board-display">{sc}</div>
            </div>
          ))}
        </div>
      </Fit>
    )
  }

  const screen = <Screen slots={data.slots} lang={settings.lang} stale={data.stale} loaded={data.loaded} />

  if (settings.frame === 'screen') {
    return (
      <Fit vp={vp} minWidth={1200} minHeight={1080}>
        {screen}
      </Fit>
    )
  }

  // The board (screen + track signs, optionally the clock) has a fixed shape, like the real thing; only the screen-only view is responsive.
  const { width: boardW, height: boardH, clockW, signsW, clockDia: dia, clockTop, vars } = boardSize(settings)
  const twoSigns = hasTwoSigns(settings)
  const clock = (
    <div
      className={`board-clock${settings.clock === 'square' ? ' square' : ''}`}
      style={{
        width: clockW,
        alignItems: settings.clock === 'top' ? 'flex-start' : 'center',
        // Top-aligned: the top of the clock level with the top edge of the display.
        paddingTop: settings.clock === 'top' ? clockTop : 0,
      }}
    >
      <Clock size={dia} />
    </div>
  )
  const signs = (
    // Two tracks: the signs are stacked and centred in the column, as on the real two-track boards.
    <div className={`board-signs${twoSigns ? ' two' : ''}`} style={{ width: signsW }}>
      <TrackSign track={settings.track} />
      {twoSigns && <TrackSign track={settings.track2} />}
    </div>
  )
  const side = settings.frame === 'board' ? clock : null
  const [first, last] = settings.side === 'left' ? [signs, side] : [side, signs]
  return (
    <Fit vp={vp} minWidth={boardW} minHeight={boardH} fixed>
      <div className="board" style={vars}>
        {first}
        <div className="board-screen">
          <div className="board-display">{screen}</div>
        </div>
        {last}
      </div>
    </Fit>
  )
}

/**
 * The screen inside the train: OBIS or the new screen (16:9) or, in an SLT, the 4:3 Sprinter screen.
 * In its housing it keeps the shape of the real screen; bare it fills the window (at least the design size).
 */
function TrainApp({ settings, departures, vp }: { settings: Settings; departures: Departure[]; vp: Viewport }) {
  const data = useTrainData(settings, departures)
  const housing = settings.frame !== 'screen'
  const kind = screenKind(settings.trainScreen, data.material)
  const { width, height } = trainSize(housing, kind)
  const props = { data, lang: settings.lang, hasSource: Boolean(settings.train || settings.station || settings.mock) }
  const screen =
    kind === 'slt' ? <SltScreen {...props} /> : kind === 'modern' ? <ModernScreen {...props} /> : <TrainScreen {...props} />
  return (
    <Fit vp={vp} minWidth={width} minHeight={height} fixed={housing}>
      {housing ? <TrainHousing kind={kind}>{screen}</TrainHousing> : screen}
    </Fit>
  )
}
