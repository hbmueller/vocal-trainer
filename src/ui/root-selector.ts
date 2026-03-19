export class RootSelector {
  private readonly noteSelect: HTMLSelectElement
  private readonly octaveSelect: HTMLSelectElement
  private changeCallbacks: Array<(noteIndex: number) => void> = []

  constructor() {
    const noteSelect = document.getElementById('root-note-select')
    if (!(noteSelect instanceof HTMLSelectElement)) {
      throw new Error('Missing #root-note-select element')
    }
    this.noteSelect = noteSelect

    const octaveSelect = document.getElementById('root-octave-select')
    if (!(octaveSelect instanceof HTMLSelectElement)) {
      throw new Error('Missing #root-octave-select element')
    }
    this.octaveSelect = octaveSelect

    const onChange = (): void => {
      const value = this.getValue()
      for (const cb of this.changeCallbacks) cb(value)
    }

    this.noteSelect.addEventListener('change', onChange)
    this.octaveSelect.addEventListener('change', onChange)
  }

  /** Returns the absolute note index (C2=0 … C6=48). */
  getValue(): number {
    const semitone = parseInt(this.noteSelect.value, 10)
    const octave   = parseInt(this.octaveSelect.value, 10)
    return (octave - 2) * 12 + semitone
  }

  /** Sets both selects from an absolute note index. */
  setValue(noteIndex: number): void {
    const semitone = noteIndex % 12
    const octave   = Math.floor(noteIndex / 12) + 2
    this.noteSelect.value   = String(semitone)
    this.octaveSelect.value = String(octave)
  }

  onChange(cb: (noteIndex: number) => void): void {
    this.changeCallbacks.push(cb)
  }
}
