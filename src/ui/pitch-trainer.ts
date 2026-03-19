import pitchDetectorUrl from '../audio/worklet/pitch-detector.ts?worker&url'
import { PITCH_UPDATE_RATE_HZ } from '../config.js'

interface PitchMessage {
  type: 'pitch'
  frequency: number | null
}

const PITCH_EMIT_INTERVAL_MS = 1000 / PITCH_UPDATE_RATE_HZ

export class PitchTrainer {
  private readonly toggle: HTMLInputElement
  private stream: MediaStream | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private workletNode: AudioWorkletNode | null = null
  private workletLoaded: boolean = false
  private lastEmitTime: number = 0

  constructor() {
    const toggle = document.getElementById('pitch-trainer-toggle')
    if (!(toggle instanceof HTMLInputElement)) {
      throw new Error('Missing #pitch-trainer-toggle element')
    }
    this.toggle = toggle
  }

  // Starts/stops based on checkbox state.
  // onPitch: called with detected frequency (Hz) or null on each detection frame.
  bind(audioCtx: AudioContext, onPitch: (freq: number | null) => void): void {
    this.toggle.addEventListener('change', () => {
      if (this.toggle.checked) {
        void this.start(audioCtx, onPitch)
      } else {
        this.stop(onPitch)
      }
    })
    // Start immediately if the toggle was already checked when bind() was called
    if (this.toggle.checked) {
      void this.start(audioCtx, onPitch)
    }
  }

  private async start(
    audioCtx: AudioContext,
    onPitch: (freq: number | null) => void,
  ): Promise<void> {
    try {
      if (!this.workletLoaded) {
        await audioCtx.audioWorklet.addModule(pitchDetectorUrl)
        this.workletLoaded = true
      }

      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      this.sourceNode = audioCtx.createMediaStreamSource(this.stream)

      this.workletNode = new AudioWorkletNode(audioCtx, 'pitch-detector')
      this.workletNode.port.onmessage = (event: MessageEvent<PitchMessage>) => {
        if (event.data.type !== 'pitch') return
        const now = performance.now()
        if (now - this.lastEmitTime < PITCH_EMIT_INTERVAL_MS) return
        this.lastEmitTime = now
        onPitch(event.data.frequency)
      }

      this.sourceNode.connect(this.workletNode)
      // Do not connect workletNode to destination — we only need the message port
    } catch (err) {
      console.error('PitchTrainer: failed to start', err)
      // Uncheck the toggle if we couldn't start
      this.toggle.checked = false
      onPitch(null)
    }
  }

  private stop(onPitch: (freq: number | null) => void): void {
    if (this.workletNode !== null) {
      this.workletNode.disconnect()
      this.workletNode.port.onmessage = null
      this.workletNode = null
    }

    if (this.sourceNode !== null) {
      this.sourceNode.disconnect()
      this.sourceNode = null
    }

    if (this.stream !== null) {
      for (const track of this.stream.getTracks()) {
        track.stop()
      }
      this.stream = null
    }

    onPitch(null)
  }
}
