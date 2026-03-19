import type { NOTE_RANGE } from '../config.js'

// Silence the unused-import lint warning; the type is imported for documentation purposes.
type _NoteRange = typeof NOTE_RANGE

export type Direction = 'up' | 'down' | 'up-down' | 'down-up'

/**
 * Builds the ordered sequence of note indices for one arpeggio run.
 *
 * @param rootIndex      - Note index of the root (C2 = 0).
 * @param activeIntervals - Sorted array of semitone offsets from the root (e.g. [0, 2, 4, 5, 7]).
 * @param direction      - The direction of the run.
 * @returns              The full ordered note-index sequence for the run.
 */
export function buildSequence(
  rootIndex: number,
  activeIntervals: readonly number[],
  direction: Direction,
): number[] {
  const ascending: number[] = activeIntervals.map((offset) => rootIndex + offset)
  const descending: number[] = [...ascending].reverse()

  switch (direction) {
    case 'up':
      return [...ascending]

    case 'down':
      return [...descending]

    case 'up-down':
      // Ascending then descending, without repeating the top note.
      return [...ascending, ...descending.slice(1)]

    case 'down-up':
      // Descending then ascending, without repeating the bottom note.
      return [...descending, ...ascending.slice(1)]
  }
}
