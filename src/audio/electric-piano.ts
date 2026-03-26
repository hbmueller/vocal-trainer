/**
 * Electric piano note synthesis.
 *
 * Based on the r/synthrecipes Electric Piano recipe:
 * https://www.reddit.com/r/synthrecipes/wiki/cookbook/recipes/instruments/electric_piano/
 *
 * Recipe elements used:
 *  - Additive synthesis: 4 sine-wave partials (1f, 2f, 3f, 4f)
 *  - Downward pitch attack: partials start slightly sharp, snap to pitch in ~20ms ("hammer click")
 *  - Amplitude envelope: fast attack → exponential decay to 75% sustain → linear release
 *  - Soft-clip WaveShaperNode: subtle harmonic warmth, mimics cabinet saturation
 *
 * See context/electric-piano-synth.md for full parameter rationale.
 */

/** Soft-clipping curve: y = (3x − x³) / 2 */
function makeSoftClipCurve(samples: number): Float32Array {
  const curve = new Float32Array(samples)
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1
    curve[i] = (3 * x - x * x * x) / 2
  }
  return curve
}

/**
 * Schedules one EP note on the Web Audio graph.
 *
 * @param ctx          - The AudioContext to use
 * @param frequency    - Fundamental frequency in Hz
 * @param beatDuration - Duration of one beat in seconds (note will sound for beatDuration * NOTE_GAP_RATIO)
 * @param startTime    - Absolute AudioContext time to begin the note
 * @param soundDuration - Pre-computed sound duration (beatDuration * NOTE_GAP_RATIO)
 */
export function scheduleEPNote(
  ctx: AudioContext,
  frequency: number,
  soundDuration: number,
  startTime: number,
): void {
  // --- Envelope timing ---
  const attackTime   = 0.010                                 // 10 ms
  const decayTime    = Math.min(0.25, soundDuration * 0.35)  // ~250 ms max
  const releaseTime  = Math.min(0.07, soundDuration * 0.15)
  const releaseStart = startTime + soundDuration - releaseTime

  // --- Shared output: waveshaper → master gain → destination ---
  const waveshaper = ctx.createWaveShaper()
  waveshaper.curve = makeSoftClipCurve(256)
  waveshaper.oversample = '2x'

  const masterGain = ctx.createGain()
  masterGain.gain.value = 1.0
  waveshaper.connect(masterGain)
  masterGain.connect(ctx.destination)

  // --- Additive partials: [harmonic multiplier, relative amplitude] ---
  // Fundamental is loudest; higher partials add brightness/body.
  // peakGain * (1 + 0.25 + 0.1 + 0.05) ≈ 0.5 → matches previous single-sine level.
  const partials: Array<[number, number]> = [
    [1, 1.00],
    [2, 0.25],
    [3, 0.10],
    [4, 0.05],
  ]
  const peakGain    = 0.36
  const sustainFrac = 0.75  // sustain at 75% of peak (recipe recommendation)

  const nodes: Array<{ osc: OscillatorNode; gain: GainNode }> = []

  for (const [mult, relAmp] of partials) {
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'

    // Downward pitch attack: start (0.3 / mult) semitones sharp, resolve to pitch in 20ms.
    // Higher partials get proportionally less bend so the detuning sounds natural.
    const bendSemitones = 0.3 / mult
    const sharpFreq = frequency * mult * Math.pow(2, bendSemitones / 12)
    osc.frequency.setValueAtTime(sharpFreq, startTime)
    osc.frequency.exponentialRampToValueAtTime(frequency * mult, startTime + 0.02)

    // Amplitude envelope
    const peak     = peakGain * relAmp
    const sustain  = Math.max(peak * sustainFrac, 0.0001)  // must be > 0 for exponentialRamp
    const decayEnd = startTime + attackTime + decayTime

    gain.gain.setValueAtTime(0, startTime)
    gain.gain.linearRampToValueAtTime(peak, startTime + attackTime)
    gain.gain.exponentialRampToValueAtTime(sustain, decayEnd)
    if (releaseStart > decayEnd) {
      gain.gain.setValueAtTime(sustain, releaseStart)
    }
    gain.gain.linearRampToValueAtTime(0.0001, startTime + soundDuration)

    osc.connect(gain)
    gain.connect(waveshaper)
    nodes.push({ osc, gain })
  }

  for (const { osc } of nodes) {
    osc.start(startTime)
    osc.stop(startTime + soundDuration)
  }

  // Cleanup after the first oscillator ends (all share the same stop time)
  nodes[0].osc.onended = () => {
    for (const { osc, gain } of nodes) {
      osc.disconnect()
      gain.disconnect()
    }
    waveshaper.disconnect()
    masterGain.disconnect()
  }
}
