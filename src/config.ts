// App-wide configuration constants

/** Full chromatic note range available throughout the app. C2 = index 0, C6 = index 48. */
export const NOTE_RANGE = { min: 0, max: 48 } as const

/** Default auto-play limits and start note, tuned for a tenor (C3–C5). */
export const AUTOPLAY_DEFAULTS = {
  lower: 12,  // C3
  start: 24,  // C4
  upper: 36,  // C5
} as const

/** BPM default */
export const DEFAULT_BPM = 100

/** Number of sub-positions per semitone for the pitch marker (≈17 cents each). */
export const PITCH_MARKER_SUBDIVISIONS = 6

/**
 * Sentinel value used in a note sequence to represent a metronome click beat.
 * The scheduler plays a click sound instead of a pitched note for this value.
 */
export const CLICK_NOTE = -1

/** Number of click beats before each arpeggio run. */
export const COUNTDOWN_BEATS = 4

/**
 * How many times per second the pitch detection result is forwarded to the UI.
 * The worklet detects at ~21 Hz; this throttles callbacks to a manageable rate.
 */
export const PITCH_UPDATE_RATE_HZ = 6

/**
 * Fraction of the beat duration that a note actually sounds.
 * The remaining fraction is silence, preventing oscillator overlaps and clicks.
 * e.g. 0.85 = note sounds for 85% of the beat, 15% silence.
 */
export const NOTE_GAP_RATIO = 0.85
