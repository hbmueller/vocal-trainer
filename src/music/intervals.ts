export interface Interval {
  semitones: number
  shortLabel: string
  name: string
}

export const INTERVALS: readonly Interval[] = [
  { semitones: 0,  shortLabel: '1',  name: 'unison' },
  { semitones: 1,  shortLabel: 'b2', name: 'minor second' },
  { semitones: 2,  shortLabel: '2',  name: 'major second' },
  { semitones: 3,  shortLabel: 'b3', name: 'minor third' },
  { semitones: 4,  shortLabel: '3M', name: 'major third' },
  { semitones: 5,  shortLabel: '4',  name: 'perfect fourth' },
  { semitones: 6,  shortLabel: 'b5', name: 'diminished fifth' },
  { semitones: 7,  shortLabel: '5',  name: 'perfect fifth' },
  { semitones: 8,  shortLabel: 'b6', name: 'minor sixth' },
  { semitones: 9,  shortLabel: '6',  name: 'major sixth' },
  { semitones: 10, shortLabel: 'b7', name: 'minor seventh' },
  { semitones: 11, shortLabel: '7M', name: 'major seventh' },
  { semitones: 12, shortLabel: '8',  name: 'octave' },
] as const
