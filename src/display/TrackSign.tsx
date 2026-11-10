/** White "spoor" sign: big number with the platform section letter as superscript. */
export function TrackSign({ track }: { track: string }) {
  const m = /^(\d+)([a-z]*)$/i.exec(track.trim())
  const num = m ? m[1] : track
  const sub = m ? m[2].toLowerCase() : ''
  return (
    <div className="track-sign">
      <span className="track-sign-label">spoor</span>
      <span className="track-sign-number">
        {num}
        {sub && <sup>{sub}</sup>}
      </span>
    </div>
  )
}
