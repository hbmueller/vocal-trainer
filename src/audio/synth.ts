import { NOTE_GAP_RATIO } from '../config.js'

export class Synth {
  private ctx: AudioContext | null = null

  /** Returns (and lazily creates) the underlying AudioContext. */
  getAudioContext(): AudioContext {
    if (this.ctx === null) {
      this.ctx = new AudioContext()
    }
    return this.ctx
  }

  /**
   * Schedules a pitched note on the Web Audio graph at an absolute AudioContext time.
   * The note sounds for `beatDuration * NOTE_GAP_RATIO` seconds, leaving a small
   * silent gap before the next note to prevent oscillator overlap and click artifacts.
   */
  scheduleNote(ctx: AudioContext, frequency: number, beatDuration: number, startTime: number): void {
    const soundDuration = beatDuration * NOTE_GAP_RATIO
    const attackTime  = Math.min(0.01, soundDuration * 0.1)
    const releaseTime = Math.min(0.06, soundDuration * 0.3)
    const holdEnd     = startTime + soundDuration - releaseTime

    const oscillator = ctx.createOscillator()
    const gainNode   = ctx.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(frequency, startTime)

    gainNode.gain.setValueAtTime(0, startTime)
    gainNode.gain.linearRampToValueAtTime(0.5, startTime + attackTime)
    // only set hold point if there's room for it
    if (holdEnd > startTime + attackTime) {
      gainNode.gain.setValueAtTime(0.5, holdEnd)
    }
    gainNode.gain.linearRampToValueAtTime(0, startTime + soundDuration)

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.start(startTime)
    oscillator.stop(startTime + soundDuration)

    oscillator.onended = () => {
      oscillator.disconnect()
      gainNode.disconnect()
    }
  }

  /**
   * Schedules a short metronome click at an absolute AudioContext time.
   * Used for the countdown before each arpeggio run.
   */
  scheduleClick(ctx: AudioContext, beatDuration: number, startTime: number): void {
    const clickDuration = Math.min(0.035, beatDuration * 0.3)

    const oscillator = ctx.createOscillator()
    const gainNode   = ctx.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(1200, startTime)

    gainNode.gain.setValueAtTime(0, startTime)
    gainNode.gain.linearRampToValueAtTime(0.35, startTime + 0.002)
    gainNode.gain.linearRampToValueAtTime(0, startTime + clickDuration)

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.start(startTime)
    oscillator.stop(startTime + clickDuration)

    oscillator.onended = () => {
      oscillator.disconnect()
      gainNode.disconnect()
    }
  }

  dispose(): void {
    if (this.ctx !== null) {
      void this.ctx.close()
      this.ctx = null
    }
  }
}
