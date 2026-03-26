# Electric Piano Synth

Source: `src/audio/electric-piano.ts`
Recipe reference: [r/synthrecipes — Electric Piano](https://www.reddit.com/r/synthrecipes/wiki/cookbook/recipes/instruments/electric_piano/)

---

## Architecture

```
4× OscillatorNode (sine)
       │
4× GainNode (per-partial envelope)
       │
  WaveShaperNode (soft clip)
       │
  GainNode (master)
       │
  ctx.destination
```

---

## Sound Source — Additive Synthesis

Four sine-wave partials, fundamental loudest:

| Partial | Multiplier | Relative amplitude |
|---------|------------|--------------------|
| 1 (fundamental) | 1× | 1.00 |
| 2nd harmonic    | 2× | 0.25 |
| 3rd harmonic    | 3× | 0.10 |
| 4th harmonic    | 4× | 0.05 |

`peakGain = 0.36` → summed peak ≈ 0.50, matching the old single-sine level.

---

## Downward Pitch Attack ("hammer click")

Each partial starts sharp by `0.3 / mult` semitones and resolves to the target pitch via `exponentialRampToValueAtTime` over **20 ms**.

Higher partials receive proportionally less bend so the onset sounds natural rather than like detuning.

---

## Amplitude Envelope

| Stage   | Value / Duration |
|---------|-----------------|
| Attack  | linear ramp to peak — **10 ms** |
| Decay   | exponential to sustain — **min(250 ms, 35% of note duration)** |
| Sustain | **75% of peak** (recipe recommendation) |
| Release | linear to silence — **min(70 ms, 15% of note duration)** |

The note ends at `beatDuration × NOTE_GAP_RATIO` (see `config.ts`), providing a small gap before the next note.

---

## Soft-Clip Waveshaper

Curve formula: `y = (3x − x³) / 2`

- Gentle saturation — no hard clipping at normal playing levels
- Adds low-order harmonic overtones, mimicking cabinet/amp warmth
- `oversample = '2x'` reduces aliasing artefacts

---

## What was omitted from the recipe

| Feature | Reason omitted |
|---------|----------------|
| Vibrato (dual LFO) | Reference pitch must be stable for vocal practice |
| Phaser | Optional colour effect, not needed for clarity |
| Stereo width / pan automation | App is mono; adds complexity for minimal benefit |
| Noise layer | Would muddy a clean reference tone |

---

## Tuning notes

- If the EP click feels too pronounced, reduce `bendSemitones` constant (currently `0.3`).
- If the decay feels too short at fast BPMs, the `soundDuration * 0.35` factor can be increased.
- The waveshaper has a negligible effect at these gain levels; it mainly rounds transient peaks slightly.
