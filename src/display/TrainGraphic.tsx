import { useId } from 'react'
import type { Composition } from '../lib/types'

const GENERIC: Composition = {
  length: 3000,
  parts: [{ width: 3000, carriages: 4 }],
  letters: [],
  directionRight: true,
}

/* Schematic sizes in design pixels, after the NS pictograms: every carriage equally wide. */
const CW = 100 // carriage width
const H = 78 // body height
const NOSE = 40 // horizontal length of the nose
const KNEE = 0.62 // where the nose starts, as a fraction of the height measured from the top
const ROOF = 7 // roof band
const CREST = 10 // extra thickness of the nose crescent at its thickest
const FLOOR = 10 // floor band
const GAP = 3 // gaps in the floor band between carriages and between units
const R = 6 // rounded bottom corners
const PIN_H = 74
const PIN_GAP = 12
const BOX = 70 // sector letter box
const BOX_GAP = 20
const PAD = 8

/** Outer contour of a unit (closed, clockwise from the bottom left). */
function outer(ax: number, bx: number, top: number) {
  const bottom = top + H
  const knee = top + H * KNEE
  const dy = knee - top
  return (
    `M${ax + R} ${bottom} Q${ax} ${bottom} ${ax} ${bottom - R} V${knee} ` +
    `C${ax} ${knee - dy * 0.5} ${ax + NOSE * 0.42} ${top} ${ax + NOSE} ${top} H${bx - NOSE} ` +
    `C${bx - NOSE * 0.42} ${top} ${bx} ${knee - dy * 0.5} ${bx} ${knee} V${bottom - R} Q${bx} ${bottom} ${bx - R} ${bottom} Z`
  )
}

/** Roof band with the crescent-shaped noses: outer contour on top, a straighter inner contour below. */
function roof(ax: number, bx: number, top: number) {
  const knee = top + H * KNEE
  const dy = knee - top
  const t = top + ROOF
  const c = CREST
  return (
    `M${ax} ${knee} C${ax} ${knee - dy * 0.5} ${ax + NOSE * 0.42} ${top} ${ax + NOSE} ${top} H${bx - NOSE} ` +
    `C${bx - NOSE * 0.42} ${top} ${bx} ${knee - dy * 0.5} ${bx} ${knee} ` +
    // inner contour, right nose then roof then left nose
    `L${bx - NOSE * 0.62} ${t + c} Q${bx - NOSE * 0.86} ${t} ${bx - NOSE * 1.35} ${t} H${ax + NOSE * 1.35} ` +
    `Q${ax + NOSE * 0.86} ${t} ${ax + NOSE * 0.62} ${t + c} Z`
  )
}

/** Location pin (marker) with its tip at (x, tipY). */
function pinPath(x: number, tipY: number) {
  const r = PIN_H * 0.36
  const cy = tipY - PIN_H + r
  const hole = r * 0.36
  return (
    `M${x} ${tipY} C${x - r * 0.25} ${tipY - r * 0.55} ${x - r} ${cy + r * 0.75} ${x - r} ${cy} ` +
    `A${r} ${r} 0 0 1 ${x + r} ${cy} C${x + r} ${cy + r * 0.75} ${x + r * 0.25} ${tipY - r * 0.55} ${x} ${tipY} Z ` +
    `M${x - hole} ${cy} a${hole} ${hole} 0 1 0 ${hole * 2} 0 a${hole} ${hole} 0 1 0 ${-hole * 2} 0 Z`
  )
}

/** Platform sector letter in a square with a filled corner, like the sector signs on the platform. */
function SectorBox({ x, y, letter }: { x: number; y: number; letter: string }) {
  const k = BOX * 0.17
  return (
    <g className="train-sector">
      <rect x={x - BOX / 2 + 1.25} y={y + 1.25} width={BOX - 2.5} height={BOX - 2.5} className="train-sector-box" />
      <rect x={x - BOX / 2} y={y} width={k} height={k} className="train-fill" />
      <text x={x} y={y + BOX * 0.8} className="train-letter">
        {letter}
      </text>
    </g>
  )
}

/**
 * Train pictogram: per unit a roof band running into crescent-shaped noses, thin sides and carriage
 * dividers and a floor band broken between carriages. Above it the "you are here" pin, or the platform
 * sector letters when known; the arrow shows the direction of travel.
 */
export function TrainGraphic({ composition }: { composition?: Composition | null }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const c = composition ?? GENERIC
  const right = c.directionRight
  const parts = c.parts.length ? c.parts : GENERIC.parts
  const cars = parts.map((p) => Math.max(1, p.carriages))
  const trainLen = cars.reduce((a, b) => a + b, 0) * CW + (cars.length - 1) * GAP

  // Letters are given in composition units relative to the train's left edge.
  const s = c.length ? trainLen / c.length : 0
  const letters = c.letters.map((l) => ({ letter: l.letter, x: (l.left + l.width / 2) * s }))

  const above = letters.length ? BOX + BOX_GAP : PIN_H + PIN_GAP
  const top = PAD + above
  const bottom = top + H

  // Units are listed front-first: the front is on the right when driving right.
  const ordered = right ? [...cars].reverse() : cars
  const units: { ax: number; bx: number; n: number }[] = []
  let acc = 0
  for (const n of ordered) {
    units.push({ ax: acc, bx: acc + n * CW, n })
    acc += n * CW + GAP
  }

  const arrowW = 40
  const arrowX = right ? trainLen + 22 : -22 - arrowW
  const minX = Math.min(0, arrowX, ...letters.map((l) => l.x - BOX / 2)) - PAD
  const maxX = Math.max(trainLen, arrowX + arrowW, ...letters.map((l) => l.x + BOX / 2)) + PAD
  const width = maxX - minX
  const height = bottom + PAD
  const arrowY = top + H * 0.6
  const a0 = right ? arrowX : arrowX + arrowW
  const dir = right ? 1 : -1
  const head = 17

  return (
    <svg className="train" viewBox={`${minX} 0 ${width} ${height}`} width={width} height={height}>
      <defs>
        {/* Gaps in the floor band between carriages. */}
        <mask id={`${id}floor`} maskUnits="userSpaceOnUse" x={minX} y={0} width={width} height={height}>
          <rect x={minX} y={0} width={width} height={height} fill="#fff" />
          {units.flatMap((u, i) =>
            Array.from({ length: u.n - 1 }, (_, k) => (
              <rect key={`${i}-${k}`} x={u.ax + (k + 1) * CW - GAP / 2} y={bottom - FLOOR - 1} width={GAP} height={FLOOR + 2} fill="#000" />
            )),
          )}
        </mask>
      </defs>

      {letters.length
        ? letters.map((l) => <SectorBox key={l.letter} x={l.x} y={PAD} letter={l.letter} />)
        : <path d={pinPath(trainLen / 2, top - PIN_GAP)} className="train-fill" fillRule="evenodd" />}

      {units.map((u, i) => (
        <g key={i}>
          <clipPath id={`${id}u${i}`}>
            <path d={outer(u.ax, u.bx, top)} />
          </clipPath>
          <path d={outer(u.ax, u.bx, top)} className="train-body" />
          <path d={roof(u.ax, u.bx, top)} className="train-fill" />
          <rect
            x={u.ax}
            y={bottom - FLOOR}
            width={u.bx - u.ax}
            height={FLOOR}
            className="train-fill"
            clipPath={`url(#${id}u${i})`}
            mask={`url(#${id}floor)`}
          />
          {Array.from({ length: u.n - 1 }, (_, k) => (
            <line key={k} x1={u.ax + (k + 1) * CW} x2={u.ax + (k + 1) * CW} y1={top + ROOF} y2={bottom - FLOOR} className="train-line" />
          ))}
        </g>
      ))}

      <path
        d={`M${a0} ${arrowY} h${arrowW * dir} M${a0 + (arrowW - head) * dir} ${arrowY - head} l${head * dir} ${head} l${-head * dir} ${head}`}
        className="train-arrow"
      />
    </svg>
  )
}
