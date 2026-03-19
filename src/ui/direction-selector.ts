import type { Direction } from '../music/arpeggio.js'

export class DirectionSelector {
  private readonly select: HTMLSelectElement
  private changeCallbacks: Array<(direction: Direction) => void> = []

  constructor() {
    const select = document.getElementById('direction-select')
    if (!(select instanceof HTMLSelectElement)) {
      throw new Error('Missing #direction-select element')
    }
    this.select = select

    this.select.addEventListener('change', () => {
      const direction = this.getValue()
      for (const cb of this.changeCallbacks) {
        cb(direction)
      }
    })
  }

  getValue(): Direction {
    return this.select.value as Direction
  }

  setValue(direction: Direction): void {
    this.select.value = direction
  }

  onChange(cb: (direction: Direction) => void): void {
    this.changeCallbacks.push(cb)
  }
}
