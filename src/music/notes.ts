// Note index convention: C2 = 0, C#2 = 1, …, B2 = 11, C3 = 12, …, C6 = 48
// MIDI note number for C2 is 36, so noteIndex = midiNote - 36
// A4 = MIDI 69 = noteIndex 33

export const NOTE_NAMES: readonly string[] = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
] as const

/** Converts a note index (C2=0) to its frequency in Hz using equal temperament (A4=440 Hz). */
export function noteIndexToFrequency(index: number): number {
  // A4 is noteIndex 33; each semitone is a factor of 2^(1/12)
  return 440 * Math.pow(2, (index - 33) / 12)
}

/** Returns the note name without octave, e.g. "C#". */
export function noteIndexToName(index: number): string {
  return NOTE_NAMES[((index % 12) + 12) % 12]
}

/** Returns the note name with octave, e.g. "C#4". */
export function noteIndexToNameWithOctave(index: number): string {
  // C2 is octave 2, indices 0–11 → octave 2, indices 12–23 → octave 3, etc.
  const octave = Math.floor(index / 12) + 2
  return `${noteIndexToName(index)}${octave}`
}

/** Converts a note name and octave number to a note index (C2=0). */
export function noteNameToIndex(name: string, octave: number): number {
  const semitone = NOTE_NAMES.indexOf(name)
  if (semitone === -1) {
    throw new Error(`Unknown note name: "${name}"`)
  }
  return (octave - 2) * 12 + semitone
}
