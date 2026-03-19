import { INTERVALS } from './intervals.js'
import type { Interval } from './intervals.js'

export type { Interval }

export interface Preset {
  name: string
  intervals: readonly number[]
  direction: 'up' | 'down' | 'up-down' | 'down-up'
}

// Ensure INTERVALS is imported so it is available for any future runtime validation.
void INTERVALS

export const PRESETS: readonly Preset[] = [
  {
    name: 'Major scale root to fifth',
    intervals: [0, 2, 4, 5, 7],
    direction: 'up-down',
  },
  {
    name: 'Fifth to root',
    intervals: [0, 2, 4, 5, 7],
    direction: 'down',
  },
  {
    name: 'Major triad',
    intervals: [0, 4, 7, 12],
    direction: 'up-down',
  },
  {
    name: 'Minor triad',
    intervals: [0, 3, 7, 12],
    direction: 'up-down',
  },
  {
    name: 'Major scale',
    intervals: [0, 2, 4, 5, 7, 9, 11, 12],
    direction: 'up-down',
  },
  {
    name: 'Natural minor',
    intervals: [0, 2, 3, 5, 7, 8, 10, 12],
    direction: 'up-down',
  },
  {
    name: 'Harmonic minor',
    intervals: [0, 2, 3, 5, 7, 8, 11, 12],
    direction: 'up-down',
  },
  {
    name: 'Melodic minor',
    intervals: [0, 2, 3, 5, 7, 9, 11, 12],
    direction: 'up-down',
  },
  {
    name: 'Major pentatonic',
    intervals: [0, 2, 4, 7, 9, 12],
    direction: 'up-down',
  },
  {
    name: 'Minor pentatonic',
    intervals: [0, 3, 5, 7, 10, 12],
    direction: 'up-down',
  },
] as const
