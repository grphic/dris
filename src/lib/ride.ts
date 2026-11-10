/**
 * "Meereizen": the train screen tells the settings page where its train is now. Switching from the train
 * screen back to a station layout on the settings page then gets you off at that station, as if you had
 * travelled along and changed trains there. Kept in sessionStorage: the preview frame and the settings page
 * (and a display opened in the same tab) share it.
 */
import type { Settings } from './settings'

export interface Ride {
  /** Which settings this ride belongs to (see rideKey) */
  key: string
  number: string
  product: string
  destination: string
  /** The station where you would get off now */
  code: string
  name: string
  track: string
  /** Rolling stock type ("SLT", "VIRM", …), empty when unknown */
  material: string
  /** When this was written (ms) */
  time: number
}

const RIDE_KEY = 'dris.ride'
/** A ride older than this is from a screen that is no longer open. */
export const RIDE_FRESH_MS = 2 * 60_000

export const rideKey = (s: Pick<Settings, 'station' | 'track' | 'train'>) => (s.train ? `trein:${s.train}` : `station:${s.station}|${s.track}`)

export function writeRide(ride: Ride) {
  try {
    sessionStorage.setItem(RIDE_KEY, JSON.stringify(ride))
  } catch {
    /* storage blocked */
  }
}

/** The current ride for these settings, if a train screen with them is (or just was) open. */
export function readRide(s: Pick<Settings, 'station' | 'track' | 'train'>): Ride | null {
  try {
    const r = JSON.parse(sessionStorage.getItem(RIDE_KEY) ?? 'null') as Ride | null
    if (r && r.key === rideKey(s) && Date.now() - r.time < RIDE_FRESH_MS) return r
  } catch {
    /* ignore */
  }
  return null
}

export function clearRide() {
  try {
    sessionStorage.removeItem(RIDE_KEY)
  } catch {
    /* ignore */
  }
}
