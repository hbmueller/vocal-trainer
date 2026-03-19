import { DEFAULT_BPM } from '../config.js'

export class TempoControls {
  private readonly bpmInput: HTMLInputElement
  private readonly subdivisionSelect: HTMLSelectElement
  private bpmCallbacks: Array<(bpm: number) => void> = []
  private subdivisionCallbacks: Array<(subdivision: number) => void> = []

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

    const subdivisionSelect = document.getElementById('subdivision-select')
    if (!(subdivisionSelect instanceof HTMLSelectElement)) {
      throw new Error('Missing #subdivision-select element')
    }
    this.subdivisionSelect = subdivisionSelect

    this.bpmInput.addEventListener('change', () => {
      const bpm = this.getBpm()
      for (const cb of this.bpmCallbacks) {
        cb(bpm)
      }
    })

    this.subdivisionSelect.addEventListener('change', () => {
      const subdivision = this.getSubdivision()
      for (const cb of this.subdivisionCallbacks) {
        cb(subdivision)
      }
    })
  }

  getBpm(): number {
    const value = parseInt(this.bpmInput.value, 10)
    if (isNaN(value)) return DEFAULT_BPM
    return Math.max(40, Math.min(240, value))
  }

  // Returns subdivision: 1=quarter, 2=eighth, 3=triplet, 4=sixteenth
  getSubdivision(): number {
    const value = parseInt(this.subdivisionSelect.value, 10)
    if (isNaN(value)) return 1
    return value
  }

  onBpmChange(cb: (bpm: number) => void): void {
    this.bpmCallbacks.push(cb)
  }

  onSubdivisionChange(cb: (subdivision: number) => void): void {
    this.subdivisionCallbacks.push(cb)
  }
}
