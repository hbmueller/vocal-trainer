import { NOTE_RANGE, AUTOPLAY_DEFAULTS } from '../config.js'
import { noteIndexToNameWithOctave } from '../music/notes.js'

export class AutoPlay {
  private readonly lowerSelect: HTMLSelectElement
  private readonly startSelect: HTMLSelectElement
  private readonly upperSelect: HTMLSelectElement
  private readonly btn: HTMLButtonElement
  private _isPlaying: boolean = false
  // Internal auto-play direction: ascending from start → upper, then descending → lower
  private goingUp: boolean = true
  private stopCallbacks: Array<() => void> = []

  constructor() {
    const lowerSelect = document.getElementById('autoplay-lower')
    if (!(lowerSelect instanceof HTMLSelectElement)) {
      throw new Error('Missing #autoplay-lower element')
    }
    this.lowerSelect = lowerSelect

    const startSelect = document.getElementById('autoplay-start')
    if (!(startSelect instanceof HTMLSelectElement)) {
      throw new Error('Missing #autoplay-start element')
    }
    this.startSelect = startSelect

    const upperSelect = document.getElementById('autoplay-upper')
    if (!(upperSelect instanceof HTMLSelectElement)) {
      throw new Error('Missing #autoplay-upper element')
    }
    this.upperSelect = upperSelect

    const btn = document.getElementById('autoplay-btn')
    if (!(btn instanceof HTMLButtonElement)) {
      throw new Error('Missing #autoplay-btn element')
    }
    this.btn = btn

    // Populate all three selects with the full note range
    const allNotes = this.buildNoteOptions()
    for (const select of [this.lowerSelect, this.startSelect, this.upperSelect]) {
      for (const { index, label } of allNotes) {
        const option = document.createElement('option')
        option.value = String(index)
        option.textContent = label
        select.appendChild(option)
      }
    }

    // Set defaults
    this.lowerSelect.value = String(AUTOPLAY_DEFAULTS.lower)
    this.startSelect.value = String(AUTOPLAY_DEFAULTS.start)
    this.upperSelect.value = String(AUTOPLAY_DEFAULTS.upper)

    this.btn.addEventListener('click', () => {
      if (this._isPlaying) {
        this.deactivate()
        for (const cb of this.stopCallbacks) {
          cb()
        }
      } else {
        this.activate()
      }
    })
  }

  private buildNoteOptions(): Array<{ index: number; label: string }> {
    const options: Array<{ index: number; label: string }> = []
    for (let i = NOTE_RANGE.min; i <= NOTE_RANGE.max; i++) {
      options.push({ index: i, label: noteIndexToNameWithOctave(i) })
    }
    return options
  }

  private activate(): void {
    this._isPlaying = true
    this.goingUp = true
    this.btn.textContent = '■ Stop'
    this.btn.classList.add('is-playing')
  }

  private deactivate(): void {
    this._isPlaying = false
    this.btn.textContent = '▶ Auto play'
    this.btn.classList.remove('is-playing')
  }

  getLower(): number {
    return parseInt(this.lowerSelect.value, 10)
  }

  getStart(): number {
    return parseInt(this.startSelect.value, 10)
  }

  getUpper(): number {
    return parseInt(this.upperSelect.value, 10)
  }

  bind(onStop: () => void): void {
    this.stopCallbacks.push(onStop)
  }

  // Called by main.ts when a sequence run ends — triggers half-step logic.
  // Returns the new root note index.
  notifyRunEnd(currentRoot: number): number {
    if (!this._isPlaying) {
      return currentRoot
    }

    const lower = this.getLower()
    const upper = this.getUpper()

    let newRoot = currentRoot

    if (this.goingUp) {
      newRoot = currentRoot + 1
      if (newRoot >= upper) {
        newRoot = upper
        this.goingUp = false
      }
    } else {
      newRoot = currentRoot - 1
      if (newRoot <= lower) {
        newRoot = lower
        // Reached the lower limit — stop auto-play
        this.deactivate()
        for (const cb of this.stopCallbacks) {
          cb()
        }
        return newRoot
      }
    }

    return newRoot
  }
}
