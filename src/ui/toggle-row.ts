import { noteIndexToName } from '../music/notes.js'
import { INTERVALS } from '../music/intervals.js'
import { PITCH_MARKER_SUBDIVISIONS } from '../config.js'

/** Pitch deviation (in semitones) considered "in tune". 2 sub-semitone positions ≈ 33 cents. */
const IN_TUNE_SEMITONES = 2 / PITCH_MARKER_SUBDIVISIONS

export class ToggleRow {
  private readonly checkboxes: HTMLInputElement[]
  private readonly labels: HTMLElement[]
  private readonly playbackMarker: HTMLElement
  private readonly pitchMarker: HTMLElement | null  // optional — not present while pitch trainer is disabled
  private changeCallbacks: Array<() => void> = []
  private userToggleOnCallbacks: Array<(semitone: number) => void> = []
  private userChangeCallbacks: Array<() => void> = []
  private currentPlaybackSemitone: number | null = null
  private _settingIntervals = false

  constructor() {
    const checkboxes = Array.from(
      document.querySelectorAll<HTMLInputElement>('.interval-toggle'),
    )
    if (checkboxes.length !== 13) {
      throw new Error(`Expected 13 .interval-toggle elements, found ${checkboxes.length}`)
    }
    this.checkboxes = checkboxes

    this.labels = Array.from(
      document.querySelectorAll<HTMLElement>('.toggle-label'),
    )

    const playbackMarker = document.getElementById('playback-marker')
    if (playbackMarker === null) throw new Error('Missing #playback-marker element')
    this.playbackMarker = playbackMarker

    this.pitchMarker = document.getElementById('pitch-marker')  // null when pitch trainer is disabled

    for (let i = 0; i < this.checkboxes.length; i++) {
      const checkbox = this.checkboxes[i]
      const semitone = i
      checkbox.addEventListener('change', () => {
        if (!this._settingIntervals) {
          if (checkbox.checked) {
            for (const cb of this.userToggleOnCallbacks) cb(semitone)
          }
          for (const cb of this.userChangeCallbacks) cb()
        }
        for (const cb of this.changeCallbacks) cb()
      })
    }
  }

  getActiveIntervals(): number[] {
    const active: number[] = []
    for (let i = 0; i < this.checkboxes.length; i++) {
      if (this.checkboxes[i].checked) active.push(i)
    }
    return active.sort((a, b) => a - b)
  }

  setActiveIntervals(semitones: readonly number[]): void {
    this._settingIntervals = true
    const activeSet = new Set(semitones)
    for (let i = 0; i < this.checkboxes.length; i++) {
      this.checkboxes[i].checked = activeSet.has(i)
    }
    this._settingIntervals = false
    for (const cb of this.changeCallbacks) cb()
  }

  updateLabels(rootNoteIndex: number): void {
    for (let i = 0; i < 13; i++) {
      const label         = this.labels[i]
      const noteName      = label.querySelector<HTMLElement>('.note-name')
      const intervalLabel = label.querySelector<HTMLElement>('.interval-label')

      if (noteName !== null) {
        noteName.textContent = noteIndexToName(rootNoteIndex + i)
      }
      if (intervalLabel !== null) {
        const interval = INTERVALS[i]
        if (interval !== undefined) intervalLabel.textContent = interval.shortLabel
      }
    }
  }

  /** Moves the playback marker (↓) to the toggle at the given semitone offset (0–12). */
  setPlaybackMarker(semitoneOffset: number | null): void {
    this.currentPlaybackSemitone = semitoneOffset
    if (semitoneOffset === null) {
      this.playbackMarker.style.visibility = 'hidden'
      return
    }
    const x = this.markerXForLabel(this.playbackMarker, this.labels[semitoneOffset])
    if (x === null) return
    this.playbackMarker.style.setProperty('--marker-x', `${x}px`)
    this.playbackMarker.style.visibility = 'visible'
  }

  /**
   * Moves the pitch marker (↑) to the given semitone offset (can be fractional).
   * Interpolates between adjacent toggle label centres for sub-semitone resolution.
   */
  setPitchMarker(pitchOffset: number | null): void {
    if (this.pitchMarker === null) return
    if (pitchOffset === null) {
      this.pitchMarker.style.visibility = 'hidden'
      this.pitchMarker.classList.remove('in-tune', 'out-of-tune')
      return
    }

    const clamped = Math.max(0, Math.min(12, pitchOffset))
    const lower   = Math.floor(clamped)
    const upper   = Math.min(12, lower + 1)
    const t       = clamped - lower

    const markerRect = this.pitchMarker!.getBoundingClientRect()
    const lowerRect  = this.labels[lower].getBoundingClientRect()
    const upperRect  = this.labels[upper].getBoundingClientRect()

    const lowerCenter = lowerRect.left + lowerRect.width / 2 - markerRect.left
    const upperCenter = upperRect.left + upperRect.width / 2 - markerRect.left
    const x           = lowerCenter + t * (upperCenter - lowerCenter)

    this.pitchMarker!.style.setProperty('--marker-x', `${x}px`)
    this.pitchMarker!.style.visibility = 'visible'

    // Colour: green if within ±2 sub-semitones of the current target note
    const target  = this.currentPlaybackSemitone
    const inTune  = target !== null && Math.abs(clamped - target) <= IN_TUNE_SEMITONES
    this.pitchMarker!.classList.toggle('in-tune', inTune)
    this.pitchMarker!.classList.toggle('out-of-tune', !inTune)
  }

  onChange(cb: () => void): void {
    this.changeCallbacks.push(cb)
  }

  /** Fires when the user manually turns a toggle ON (not when set programmatically). */
  onUserToggleOn(cb: (semitone: number) => void): void {
    this.userToggleOnCallbacks.push(cb)
  }

  /** Fires on any user-initiated toggle change (on or off). */
  onUserChange(cb: () => void): void {
    this.userChangeCallbacks.push(cb)
  }

  /** Computes the pixel offset of a label's centre relative to the marker element. */
  private markerXForLabel(marker: HTMLElement, label: HTMLElement): number | null {
    const markerRect = marker.getBoundingClientRect()
    const labelRect  = label.getBoundingClientRect()
    if (markerRect.width === 0) return null
    return labelRect.left + labelRect.width / 2 - markerRect.left
  }
}
