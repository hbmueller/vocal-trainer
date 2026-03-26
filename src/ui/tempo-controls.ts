import { DEFAULT_BPM } from '../config.js'

export class TempoControls {
  private readonly bpmInput: HTMLInputElement
  private bpmCallbacks: Array<(bpm: number) => void> = []

  constructor() {
    const bpmInput = document.getElementById('bpm-input')
    if (!(bpmInput instanceof HTMLInputElement)) {
      throw new Error('Missing #bpm-input element')
    }
    this.bpmInput = bpmInput

    // Ensure the default value matches config
    if (this.bpmInput.value === '') {
      this.bpmInput.value = String(DEFAULT_BPM)
    }

    this.bpmInput.addEventListener('change', () => {
      const bpm = this.getBpm()
      for (const cb of this.bpmCallbacks) {
        cb(bpm)
      }
    })
  }

  getBpm(): number {
    const value = parseInt(this.bpmInput.value, 10)
    if (isNaN(value)) return DEFAULT_BPM
    return Math.max(40, Math.min(240, value))
  }

  getSubdivision(): number {
    return 1  // always quarter notes
  }

  onBpmChange(cb: (bpm: number) => void): void {
    this.bpmCallbacks.push(cb)
  }

  onSubdivisionChange(_cb: (subdivision: number) => void): void {
    // subdivision is fixed at 1; kept for interface compatibility
  }
}
