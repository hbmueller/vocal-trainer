import { PRESETS } from '../music/presets.js'
import type { Preset } from '../music/presets.js'

export class PresetSelector {
  private readonly select: HTMLSelectElement
  private changeCallbacks: Array<(preset: Preset) => void> = []

  constructor() {
    const select = document.getElementById('preset-select')
    if (!(select instanceof HTMLSelectElement)) {
      throw new Error('Missing #preset-select element')
    }
    this.select = select

    // Populate options from PRESETS (the placeholder option already exists in HTML)
    for (let i = 0; i < PRESETS.length; i++) {
      const option = document.createElement('option')
      option.value = String(i)
      option.textContent = PRESETS[i].name
      this.select.appendChild(option)
    }

    this.select.addEventListener('change', () => {
      const index = parseInt(this.select.value, 10)
      if (isNaN(index)) return  // placeholder selected
      const preset = PRESETS[index]
      if (preset === undefined) return
      for (const cb of this.changeCallbacks) {
        cb(preset)
      }
    })
  }

  onChange(cb: (preset: Preset) => void): void {
    this.changeCallbacks.push(cb)
  }
}
