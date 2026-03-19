import { Synth } from './synth.js'
import { CLICK_NOTE } from '../config.js'
import { noteIndexToFrequency } from '../music/notes.js'

const LOOKAHEAD_SECONDS   = 0.1   // schedule this far ahead
const SCHEDULE_INTERVAL_MS = 25   // scheduler tick rate

export class Scheduler {
  private readonly synth: Synth
  private sequence: number[]      = []
  private nextSequence: number[] | null = null
  private bpm: number             = 100
  private subdivision: number     = 1
  private _onNote: ((noteIndex: number) => void) | null = null
  private _onRunEnd: (() => void) | null = null
  private _isPlaying: boolean     = false
  private currentNoteInRun: number = 0
  private nextNoteTime: number    = 0
  private timerId: ReturnType<typeof setTimeout> | null = null
  /** True between the last note of a run being scheduled and onRunEnd firing. Prevents scheduling notes for the next run before the callback decides whether to continue. */
  private _runEnding: boolean = false

  constructor(synth: Synth) {
    this.synth = synth
  }

  get isPlaying(): boolean {
    return this._isPlaying
  }

  start(
    sequence: number[],
    bpm: number,
    subdivision: number,
    onNote: (noteIndex: number) => void,
    onRunEnd: () => void,
  ): void {
    this.stop()

    this.sequence        = sequence.slice()
    this.nextSequence    = null
    this.bpm             = bpm
    this.subdivision     = subdivision
    this._onNote         = onNote
    this._onRunEnd       = onRunEnd
    this.currentNoteInRun = 0
    this._runEnding      = false
    this._isPlaying      = true

    const ctx = this.synth.getAudioContext()
    this.nextNoteTime = ctx.currentTime

    this.tick()
  }

  updateSequence(sequence: number[]): void {
    this.nextSequence = sequence.slice()
  }

  stop(): void {
    this._isPlaying = false
    if (this.timerId !== null) {
      clearTimeout(this.timerId)
      this.timerId = null
    }
  }

  private beatDuration(): number {
    return (60 / this.bpm) / this.subdivision
  }

  private tick(): void {
    if (!this._isPlaying) return

    const ctx      = this.synth.getAudioContext()
    const duration = this.beatDuration()

    while (!this._runEnding && this.nextNoteTime < ctx.currentTime + LOOKAHEAD_SECONDS) {
      if (this.sequence.length === 0) break

      const noteIndex   = this.sequence[this.currentNoteInRun]
      const scheduleTime = this.nextNoteTime

      if (noteIndex === CLICK_NOTE) {
        // Metronome click — schedule sound but don't fire onNote
        this.synth.scheduleClick(ctx, duration, scheduleTime)
      } else {
        // Pitched note — schedule sound and fire onNote callback at play time
        const frequency = noteIndexToFrequency(noteIndex)
        this.synth.scheduleNote(ctx, frequency, duration, scheduleTime)

        const msUntilNote    = Math.max(0, (scheduleTime - ctx.currentTime) * 1000)
        const capturedOnNote = this._onNote
        setTimeout(() => {
          if (this._isPlaying && capturedOnNote !== null) {
            capturedOnNote(noteIndex)
          }
        }, msUntilNote)
      }

      this.nextNoteTime += duration
      this.currentNoteInRun++

      if (this.currentNoteInRun >= this.sequence.length) {
        // Pause scheduling until onRunEnd decides whether to continue
        this._runEnding = true

        if (this.nextSequence !== null) {
          this.sequence     = this.nextSequence
          this.nextSequence = null
        }

        const msUntilRunEnd    = Math.max(0, (scheduleTime + duration - ctx.currentTime) * 1000)
        const capturedOnRunEnd = this._onRunEnd
        setTimeout(() => {
          if (!this._isPlaying) return
          // Call the callback first — it may update nextSequence via rebuildSequence()
          if (capturedOnRunEnd !== null) capturedOnRunEnd()
          if (!this._isPlaying) return  // callback may have stopped playback
          // Apply any sequence update that arrived during the callback
          if (this.nextSequence !== null) {
            this.sequence     = this.nextSequence
            this.nextSequence = null
          }
          this.currentNoteInRun = 0
          this._runEnding       = false
        }, msUntilRunEnd)
      }
    }

    this.timerId = setTimeout(() => this.tick(), SCHEDULE_INTERVAL_MS)
  }
}
