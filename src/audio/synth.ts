import { NOTE_GAP_RATIO } from '../config.js'
import { scheduleEPNote } from './electric-piano.js'

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
   * Schedules a pitched note using the electric piano model.
   * See src/audio/electric-piano.ts for implementation details.
   */
  scheduleNote(ctx: AudioContext, frequency: number, beatDuration: number, startTime: number): void {
    const soundDuration = beatDuration * NOTE_GAP_RATIO
    scheduleEPNote(ctx, frequency, soundDuration, startTime)
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
