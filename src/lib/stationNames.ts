import { useSyncExternalStore } from 'react'
import { fetchStations } from './api'

/**
 * Shorter NS names per full station name ("Amsterdam Bijlmer ArenA" → medium and short name), loaded once
 * from the stations list (cached for a day). Until it has loaded, or without it (demo, no key), names are
 * only shortened with an ellipsis.
 */
let names = new Map<string, string[]>()
let started = false
const listeners = new Set<() => void>()

function load() {
  if (started) return
  started = true
  fetchStations()
    .then((list) => {
      names = new Map(list.map((s) => [s.name.toLowerCase(), [s.nameMedium, s.nameShort].filter(Boolean)]))
      listeners.forEach((l) => l())
    })
    .catch(() => {
      /* no station list: only the ellipsis */
    })
}

function subscribe(l: () => void) {
  load()
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Shorter forms of a station name, longest first, using NS's own names: "Leiden Centraal" → "Leiden C." → "Leiden C". */
export function useNameVariants(name: string): string[] {
  const map = useSyncExternalStore(subscribe, () => names)
  const all = [name, ...(map.get(name.toLowerCase()) ?? [])]
  // Each next form must be shorter than the one before it.
  return all.filter((n, i) => i === 0 || n.length < all.slice(0, i).reduce((min, x) => Math.min(min, x.length), Infinity))
}
