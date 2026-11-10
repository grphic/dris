import type { CSSProperties } from 'react'
import type { Settings } from './settings'

/*
 * Design size of the full board. The departure screen itself is always 16:9 (1920 × 1080); the board
 * around it is the track-sign column, the clock panel, the gaps and the screen's housing padding.
 * These mirror display.css (.board-signs, .board gap, .board-screen padding).
 */
const SCREEN_W = 1920
const SCREEN_H = 1080
// Track-sign column: narrower with one sign, wider with two (larger) stacked signs.
const SIGNS_W = 470
const SIGN = 390 // track sign design size (.track-sign in display.css)
const SIGN_MARGIN = 60 // housing beside each of the two stacked signs
const CLOCK_W = 820 // narrower grey clock panel (smaller clock)
const GAP = 14
const BARE_GAP = 24 // between bare overview screens
// Housing around the display, measured from photos (about 6% of the screen width/height), plus the
// display's own black glass edge.
const PAD_X = 104
const PAD_Y = 80
const BEZEL = 12
// Two departures: the blue band between the halves of the screen. The two stacked signs line up with the
// top and bottom of the display, and the space between them is exactly this band.
const SPLIT = 84
const SIGN_TWO = (SCREEN_H + 2 * BEZEL - SPLIT) / 2
const SIGNS_W_TWO = Math.round(SIGN_TWO) + 2 * SIGN_MARGIN
/** Clock diameter as a fraction of the panel width: nearly filling the square panel, smaller in the narrow one. */
const CLOCK_FILL_SQUARE = 0.88
const CLOCK_FILL_NARROW = 0.8

/** Bare overview screens side by side: design size of the row of screens. */
export function overviewSize(screens: number) {
  return { width: screens * SCREEN_W + (screens - 1) * BARE_GAP, height: SCREEN_H, gap: BARE_GAP }
}

/** Whether the board shows two track signs (two departures on two different tracks). */
export function hasTwoSigns(s: Pick<Settings, 'layout' | 'track' | 'track2'>) {
  return s.layout === 'double' && Boolean(s.track2) && s.track2 !== s.track
}

export function boardSize(s: Pick<Settings, 'frame' | 'clock' | 'layout' | 'track' | 'track2' | 'screens'>) {
  const height = SCREEN_H + 2 * (PAD_Y + BEZEL)
  // The square panel is as wide as the board is high, like the white clock boxes on some boards.
  const overview = s.layout === 'overview'
  const clockW = overview || s.frame !== 'board' ? 0 : s.clock === 'square' ? height : CLOCK_W
  const signsW = overview ? 0 : hasTwoSigns(s) ? SIGNS_W_TWO : SIGNS_W
  const housing = SCREEN_W + 2 * (PAD_X + BEZEL)
  return {
    // Overview: only screens in their housings, side by side (no track signs or clock next to them).
    width: overview ? s.screens * housing + (s.screens - 1) * GAP : signsW + clockW + (clockW ? 2 : 1) * GAP + housing,
    height,
    clockW,
    signsW,
    clockDia: Math.round(clockW * (s.clock === 'square' ? CLOCK_FILL_SQUARE : CLOCK_FILL_NARROW)),
    /** Top-aligned clock: level with the top edge of the display (and the track sign). */
    clockTop: PAD_Y,
    /** CSS variables for the housing (see .board-screen in display.css). */
    vars: {
      '--pad-x': `${PAD_X}px`,
      '--pad-y': `${PAD_Y}px`,
      '--bezel': `${BEZEL}px`,
      '--split': `${SPLIT}px`,
      '--sign-two-zoom': SIGN_TWO / SIGN,
    } as CSSProperties,
  }
}
