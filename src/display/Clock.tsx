import { useEffect, useId, useRef } from 'react'

/**
 * Station clock: blue markers, dark hands, red second hand with a ring.
 * The second hand sweeps round in 58.5 s and waits at 12 for the minute pulse;
 * the minute hand jumps once per minute.
 */
export function Clock({ size }: { size?: number }) {
  const hour = useRef<SVGGElement>(null)
  const minute = useRef<SVGGElement>(null)
  const second = useRef<SVGGElement>(null)
  const id = useId().replace(/:/g, '')

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const now = new Date()
      const parts = new Intl.DateTimeFormat('en-GB', {
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
        timeZone: 'Europe/Amsterdam',
      }).formatToParts(now)
      const h = Number(parts.find((p) => p.type === 'hour')!.value) % 12
      const m = Number(parts.find((p) => p.type === 'minute')!.value)
      const ms = now.getSeconds() * 1000 + now.getMilliseconds()
      const sweep = Math.min(ms / 58500, 1)
      second.current?.setAttribute('transform', `rotate(${sweep * 360})`)
      minute.current?.setAttribute('transform', `rotate(${m * 6})`)
      hour.current?.setAttribute('transform', `rotate(${h * 30 + m * 0.5})`)
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [])

  const marks = []
  for (let i = 0; i < 60; i++) {
    const major = i % 5 === 0
    marks.push(
      major ? (
        <rect key={i} x={-5} y={-91} width={10} height={23} rx={5} transform={`rotate(${i * 6})`} />
      ) : (
        <circle key={i} cx={0} cy={-88} r={1.6} transform={`rotate(${i * 6})`} />
      ),
    )
  }

  return (
    <svg className="clock" viewBox="-110 -110 220 220" width={size ?? 560} height={size ?? 560} aria-label="Klok">
      <defs>
        {/* Recessed dial, light from above: the rim's inner wall is in shadow at the top and lit at the bottom. */}
        <linearGradient id={`${id}wall`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a6aab6" />
          <stop offset="0.5" stopColor="#cdd0d8" />
          <stop offset="1" stopColor="#f3f4f7" />
        </linearGradient>
        {/* Outer edge of the glass: the opposite way round, a thin bevel. */}
        <linearGradient id={`${id}lip`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6f7f9" />
          <stop offset="1" stopColor="#c4c7d0" />
        </linearGradient>
        {/* Shadow the rim casts onto the dial, heaviest at the top. */}
        <radialGradient id={`${id}shade`} gradientUnits="userSpaceOnUse" cx={0} cy={7} r={104}>
          <stop offset="0.9" stopColor="#1c1f2e" stopOpacity="0" />
          <stop offset="1" stopColor="#1c1f2e" stopOpacity="0.18" />
        </radialGradient>
        <clipPath id={`${id}dial`}>
          <circle r={100} />
        </clipPath>
      </defs>
      <circle r={108} fill={`url(#${id}lip)`} />
      <circle r={105.5} fill={`url(#${id}wall)`} />
      <circle r={100} className="clock-face" />
      <circle r={104} cy={0} fill={`url(#${id}shade)`} clipPath={`url(#${id}dial)`} />
      <g className="clock-marks">{marks}</g>
      <g ref={hour}>
        <path d="M-6 18 V-52 A6 6 0 0 1 6 -52 V18 Z" className="clock-hand" />
      </g>
      <g ref={minute}>
        <path d="M-4 20 V-81 A4 4 0 0 1 4 -81 V20 Z" className="clock-hand" />
      </g>
      <g ref={second} className="clock-second">
        {/* Ring one diameter closer to the pivot than before. */}
        <rect x={-1.2} y={-44} width={2.4} height={68} />
        <circle cy={-52} r={8} fill="none" strokeWidth={2.6} />
        <rect x={-1.2} y={-92} width={2.4} height={32} />
        <circle r={3.5} />
      </g>
    </svg>
  )
}
