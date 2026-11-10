import type { Composition, Departure } from './types'

function at(minFromNow: number): Date {
  const d = new Date(Date.now() + minFromNow * 60000)
  d.setSeconds(0, 0)
  return d
}

function dep(p: Partial<Departure> & { min: number; direction: string }): Departure {
  const planned = at(p.min)
  const delay = p.delayMin ?? 0
  return {
    id: `${p.number ?? p.direction}-${p.min}`,
    number: p.number ?? '1234',
    planned,
    actual: new Date(planned.getTime() + delay * 60000),
    delayMin: delay,
    plannedTrack: p.track ?? '9a',
    track: p.track ?? '9a',
    productLong: 'Intercity',
    productShort: 'IC',
    operatorCode: 'NS',
    operatorName: 'NS',
    cancelled: false,
    via: [],
    warnings: [],
    infos: [],
    ...p,
  }
}

/** Demo data for the selected track(s), modelled on the reference photos. */
export function mockDepartures(track: string, track2: string): Departure[] {
  const t2 = track2 || track
  return [
    dep({
      min: 2,
      track,
      direction: 'Enschede',
      viaHighlight: 'Amersfoort Centraal',
      via: ['Hilversum', 'Amersfoort Centraal', 'Apeldoorn', 'Deventer', 'Holten', 'Rijssen', 'Wierden', 'Almelo',
        'Borne', 'Hengelo', 'Enschede Kennispark'],
      infos: ['Achterste treinstel tot Deventer'],
      infosEn: ['Rear train unit to Deventer'],
    }),
    dep({ min: 6, track: t2, direction: 'Dordrecht', productLong: 'Sprinter', productShort: 'SPR', number: '6957',
      via: ['Elst', 'Nijmegen', 'Oss', "'s-Hertogenbosch"] }),
    dep({ min: 32, track, direction: 'Den Haag Centraal', viaHighlight: 'Schiphol Airport', via: ['Utrecht Centraal', 'Amsterdam Zuid', 'Schiphol Airport', 'Leiden C.'], delayMin: 5 }),
    dep({ min: 36, track: t2, direction: 'Tiel', productLong: 'Sprinter', productShort: 'SPR', operatorCode: 'ARR',
      operatorName: 'Arriva', via: ['Elst', 'Zetten-Andelst', 'Hemmen-Dodewaard'], warnings: ['Stopt niet in Arnhem Zuid'], warningsEn: ['Does not stop at Arnhem Zuid'] }),
    dep({ min: 62, track, direction: 'Leeuwarden', via: ['Amersfoort Centraal', 'Zwolle'] }),
  ]
}

export function mockComposition(): Composition {
  const w = 3376
  return {
    length: w,
    parts: [{ width: w / 2, carriages: 3 }, { width: w / 2, carriages: 3 }],
    letters: 'ABCDEF'.split('').map((letter, i) => ({ letter, left: (i * w) / 6, width: w / 6 })),
    directionRight: true,
  }
}

/** Demo data for the departures overview, modelled on a photo of the overview screens. */
export function mockOverview(): Departure[] {
  const spr = { productLong: 'Sprinter', productShort: 'SPR' }
  return [
    dep({ min: 3, track: '21', direction: "'s-Hertogenbosch", ...spr, number: '6430',
      infos: ["10:23 IC Venlo spoor 18 eerder in 's-Hertogenbosch"], infosEn: ["10:23 IC Venlo platform 18 arrives earlier in 's-Hertogenbosch"] }),
    dep({ min: 3, track: '9', direction: 'Leeuwarden', via: ['Amersfoort C.', 'Zwolle', 'Steenwijk'] }),
    dep({ min: 3, track: '4', direction: 'Zwolle', via: ['Overvecht', 'Den Dolder', 'Amersfoort C.'] }),
    dep({ min: 4, track: '7', direction: 'Enkhuizen', delayMin: 5, via: ['Amstel', 'Amsterdam C.', 'Sloterdijk', 'Zaandam'] }),
    dep({ min: 5, track: '19', direction: 'Nijmegen', delayMin: 5, via: ['Driebergen-Zeist', 'Ede-Wageningen', 'Arnhem C.'] }),
    dep({ min: 5, track: '18', direction: 'Venlo', via: ["'s-Hertogenbosch", 'Eindhoven C.', 'Helmond'] }),
    dep({ min: 7, track: '1', direction: 'Almere Centrum', ...spr,
      warnings: ['Stopt niet in Holl. Rading, Media Park, Bussum Zuid'], warningsEn: ['Does not stop at Holl. Rading, Media Park, Bussum Zuid'] }),
    dep({ min: 8, track: '11b', direction: 'Amsterdam Centraal', via: ['Amsterdam Bijlmer ArenA', 'Amsterdam Amstel'] }),
    dep({ min: 10, track: '5', direction: 'Den Haag Centraal', via: ['Gouda'] }),
    dep({ min: 13, track: '14', direction: 'Schiphol Airport', via: ['Amsterdam Bijlmer ArenA', 'Amsterdam Zuid'] }),
    dep({ min: 15, track: '12', direction: 'Tiel', ...spr, via: ['Houten', 'Culemborg', 'Geldermalsen'] }),
    dep({ min: 17, track: '8', plannedTrack: '7', direction: 'Enschede', via: ['Amersfoort C.', 'Apeldoorn', 'Deventer', 'Almelo'],
      warnings: ['Dit is een gewijzigd vertrekspoor'], warningsEn: ['This is a changed departure platform'] }),
    dep({ min: 19, track: '15b', direction: 'London St. Pancras Int', productLong: 'Eurostar', productShort: 'EST', number: '9147',
      infos: ['Eurostar London: vertrek van de UK Terminal'], infosEn: ['Eurostar London: departure from the UK Terminal'] }),
    dep({ min: 21, track: '20', direction: 'Baarn', ...spr, cancelled: true, warnings: ['Rijdt niet'], warningsEn: ['Cancelled'] }),
    dep({ min: 22, track: '3', direction: 'Rotterdam Centraal', via: ['Gouda'] }),
    dep({ min: 24, track: '15', direction: 'Breda', ...spr, via: ['Houten Castellum', 'Geldermalsen', "'s-Hertogenbosch"] }),
    dep({ min: 26, track: '10', direction: 'Maastricht', via: ["'s-Hertogenbosch", 'Eindhoven C.', 'Weert', 'Roermond'] }),
    dep({ min: 28, track: '22', direction: 'Woerden', ...spr, via: ['Utrecht Terwijde', 'Vleuten'] }),
    dep({ min: 31, track: '7', direction: 'Den Helder', via: ['Amsterdam C.', 'Zaandam', 'Alkmaar'] }),
  ]
}
