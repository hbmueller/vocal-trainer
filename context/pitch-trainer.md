# Pitch Trainer — Design & Implementation Notes

> **Status: removed from UI.** The feature caused persistent audio artifacts and the detection was not reliable enough for use. All source files are preserved. This document captures the full intended design so it can be reintroduced correctly.

---

## What it should do

While auto-play (or single play) is running, the pitch trainer listens to the microphone and shows the user how accurately they are singing the current target note.

- A **live pitch marker** (`↑`) appears below the toggle row, directly beneath the playback marker (`↓`)
- The `↑` marker moves left/right in real time to show where the user's voice sits on the chromatic scale relative to the current root
- It has **sub-semitone resolution**: 6 positions per half-step (≈17 cents each), so the singer gets fine-grained feedback even when close to the target
- Colour indicates accuracy relative to the current target note (the note the `↓` marker is on):
  - **Green** — within ±2 sub-positions (≈33 cents) of the target → in tune
  - **Red** — more than 2 sub-positions away → out of tune
- The marker is hidden when the pitch trainer is off

---

## Architecture

### Signal chain

```
Microphone (getUserMedia)
  └─ MediaStreamAudioSourceNode
       └─ AudioWorkletNode('pitch-detector')   ← YIN runs here, audio thread
            └─ port.postMessage({ type: 'pitch', frequency })
                 └─ main thread: PitchTrainer throttles to PITCH_UPDATE_RATE_HZ
                      └─ ToggleRow.setPitchMarker(semitoneOffset)
```

The worklet is NOT connected to `ctx.destination` — it only processes audio for detection, no sound passes through.

### Files

| File | Purpose |
|---|---|
| `src/audio/worklet/pitch-detector.ts` | AudioWorklet processor — runs YIN on audio thread |
| `src/ui/pitch-trainer.ts` | Binds toggle, loads worklet, manages mic stream, throttles callbacks |
| `src/ui/toggle-row.ts` | `setPitchMarker(offset)` — positions and colours the `↑` marker |

---

## YIN algorithm (pitch-detector.ts)

YIN is used over autocorrelation because it handles the harmonic content of the human voice better and avoids octave errors.

**Pipeline per detection frame:**

1. **Difference function** `d(τ)` — mean square difference between the signal and a τ-lagged copy, over a half-buffer window
2. **Cumulative mean normalised difference (CMNDF)** — normalises `d(τ)` so the threshold is scale-independent; `d'(0) = 1` by definition
3. **Absolute threshold** — find the first τ where `d'(τ) < 0.15` (at the trough); fall back to the global minimum
4. **Parabolic interpolation** — sub-sample refinement of the lag estimate
5. **Frequency** — `f = sampleRate / refinedTau`; discard if outside 80–1100 Hz

**Key constants:**

| Constant | Value | Reason |
|---|---|---|
| `BUFFER_SIZE` | 2048 samples | Balances latency (~46ms) vs. accuracy for low vocal fundamentals |
| `YIN_THRESHOLD` | 0.15 | Standard YIN value; lower = stricter confidence |
| `MIN_FREQUENCY` | 80 Hz | Below bass vocal range |
| `MAX_FREQUENCY` | 1100 Hz | Above soprano range |
| `PROCESS_EVERY_N_FILLS` | 2 | Run YIN every 2 buffer fills (~10 Hz) to halve audio-thread load |

### Vite build requirement

The worklet file must be imported with `?worker&url` (not `?url`) so Vite compiles the TypeScript to JavaScript before the browser loads it via `addModule()`. `vite.config.ts` must set `worker.format: 'es'`.

```ts
import pitchDetectorUrl from '../audio/worklet/pitch-detector.ts?worker&url'
await audioCtx.audioWorklet.addModule(pitchDetectorUrl)
```

---

## Known issues (reasons for removal)

### 1. Audio artifacts / crackling

Opening the mic stream and running the AudioWorklet appears to stress the audio rendering thread enough to cause dropouts in the synth playback. Possible causes:

- The YIN O(N²) inner loop (~1M operations per frame) may be too slow for the audio thread even at the reduced rate. Profiling needed.
- The `AudioContext` is shared between the synth scheduler and the pitch worklet. Contention between scheduled oscillators and the worklet processing may cause glitches.
- Possible fix A: use a **separate AudioContext** for pitch detection (isolates the worklet thread load from the synth)
- Possible fix B: port the YIN inner loop to **WASM** for a 5–10× speedup
- Possible fix C: reduce `BUFFER_SIZE` to 1024 (halves computation at the cost of lower-frequency accuracy; still fine for tenor/soprano range above ~130 Hz)

### 2. Arrow appears broken / no detection

Two bugs were found during the removal session:

**Bug A — `{ once: true }` initialization** (`main.ts`): The pitch trainer toggle's change listener was registered with `{ once: true }`, which removed it after the first fire. `pitchTrainer.bind()` was called but only registered a listener for *future* changes — the initial check event was already consumed. Result: first toggle check did nothing. The fix (already applied in `pitch-trainer.ts`) is to call `start()` immediately inside `bind()` if the toggle is already checked.

**Bug B — worklet loaded as raw TypeScript** (`pitch-trainer.ts`): The original `?url` import copied `pitch-detector.ts` as a raw TypeScript file into `dist/`. Browsers cannot execute TypeScript natively, so `addModule()` failed silently. The fix (already applied) is `?worker&url` + `worker.format: 'es'` in `vite.config.ts`.

Both fixes are in the current codebase even though the UI is disabled, so they will be correct when the feature is reintroduced.

### 3. Marker position relative to the target note

`setPitchMarker` positions the arrow based on a semitone offset from the *root* note, but the target note (what the `↓` marker is on) changes on every step. The `ToggleRow` already tracks `currentPlaybackSemitone` and uses it for the green/red colour, but the arrow position itself is always relative to the root (0 = root, 12 = octave). This is the intended design — it shows where you are on the scale, not just how far from the current note. Verify this feels correct during testing.

---

## Reintroduction checklist

- [ ] Fix audio artifacts: profile the worklet or try a separate AudioContext for detection
- [ ] Consider WASM port of the YIN inner loop if JS is the bottleneck
- [ ] Add the pitch trainer row back to `index.html`
- [ ] Add `#pitch-marker` div back to the toggle row section in `index.html`
- [ ] Re-import `PitchTrainer` in `main.ts` and restore the wiring block
- [ ] Restore `pitchMarker` handling in `toggle-row.ts` (currently stripped to optional)
- [ ] Manually test: check/uncheck toggle, confirm mic permission prompt, confirm arrow moves, confirm colour changes, confirm no audio glitches
- [ ] Test on GitHub Pages (production build) to confirm `?worker&url` worklet URL resolves correctly
