export interface Departure {
  id: string
  /** Train number (ritnummer), used for Virtual Train */
  number: string
  planned: Date
  actual: Date
  /** Delay in whole minutes (0 when on time) */
  delayMin: number
  plannedTrack: string
  track: string
  /** Destination shown on the board */
  direction: string
  /** Original destination when the train terminates early (shown struck through) */
  originalDirection?: string
  /** Well-known station on the route, shown in a pill after the destination ("via Hilversum") */
  viaHighlight?: string
  /** e.g. "Intercity", "Sprinter", "Intercity direct" */
  productLong: string
  /** e.g. "IC", "SPR", "ICD" */
  productShort: string
  operatorCode: string
  operatorName: string
  cancelled: boolean
  via: string[]
  /** Yellow lines (warnings) */
  warnings: string[]
  /** Informational lines */
  infos: string[]
  /** English versions of warnings/infos (same order); missing when not fetched */
  warningsEn?: string[]
  infosEn?: string[]
}

export interface Station {
  code: string
  name: string
  nameMedium: string
  /** NS short name, e.g. "Amsterdam C" */
  nameShort: string
  tracks: string[]
  country: string
}

export interface Composition {
  /** Width of each train unit in the same units as `length` */
  parts: { width: number; carriages: number }[]
  length: number
  letters: { letter: string; left: number; width: number }[]
  directionRight: boolean
}
