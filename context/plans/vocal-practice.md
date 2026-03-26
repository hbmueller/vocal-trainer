# Vocal Practice App — Plan

## Stack
- **Vanilla TypeScript** (no framework) — performance-first
- **SCSS Modules** — scoped styles, minimal runtime cost
- **GitHub Pages** — static hosting, no backend
- **Dark theme** with CSS custom properties mapped to SCSS vars
- **Vite** — bundler; chosen for ESM-first output, native SCSS Modules support, HTML template injection, and minimal runtime scaffolding in the build output (no AMD/CommonJS wrappers — just your code); `worker.format: 'es'` required so the AudioWorklet file is compiled to JavaScript (not left as raw `.ts`)

---

## Module Structure

The HTML is static — all markup lives in `index.html`. TypeScript modules bind to elements by ID or class name; they never create or inject DOM nodes.

Toggles are written as:
```html
<label class="toggle-label">
  <input type="checkbox" class="interval-toggle" />
  <span class="note-name">E</span>
  <span class="interval-label">3M</span>
</label>
```
The note name and interval span are updated in place when the root note changes. The toggle array is handled as `document.querySelectorAll('.interval-toggle')`.

File layout:

```
index.html              # All markup — IDs/classes for every bindable element
src/
  main.ts               # Entry point — imports and initializes all modules
  config.ts             # App-wide constants (NOTE_RANGE, TENOR_DEFAULTS, etc.)
  audio/
    synth.ts            # Web Audio API — note synthesis, envelope
    scheduler.ts        # Tempo/subdivision clock, arpeggio sequencing
    worklet/
      pitch-detector.ts # AudioWorklet processor (YIN algorithm)
  music/
    notes.ts            # Note index → frequency + note name (no MIDI protocol;
                        # "note index" is just an integer: C2=0, C#2=1, … C6=48)
    intervals.ts        # Chromatic interval definitions + short-form labels (3M, 3m, 7m, 8, etc.)
    presets.ts          # Preset definitions
    arpeggio.ts         # Arpeggio pattern + direction logic
  ui/
    toggle-row.ts       # Binds interval toggles; updates note names + interval labels; moves markers
    root-selector.ts    # Binds #root-note-select + #root-octave-select; returns absolute note index
    preset-selector.ts  # Binds preset dropdown
    direction-selector.ts
    tempo-controls.ts   # Binds BPM input (subdivision fixed at quarter notes)
    auto-play.ts        # Binds lower/start/upper selects, drives auto-play logic
    pitch-trainer.ts    # Binds mic toggle; drives pitch marker
  styles/
    main.scss
    _theme.scss         # CSS custom properties + SCSS var mappings
    *.module.scss       # Per-component SCSS modules
```

---

## Features

### 1. Sound Generation
Uses the **Web Audio API** with an electric piano model (`src/audio/electric-piano.ts`): 4 additive sine partials, downward pitch attack for the characteristic EP click, EP-style amplitude envelope (fast attack → exponential decay to 75% sustain), and a soft-clip WaveShaperNode for cabinet warmth. Full parameter rationale in `context/electric-piano-synth.md`.

### 2. Arpeggio Configuration
- **Root note selector** — two selects: note name (C–B) + octave (2–6); toggle labels update when either changes
- **Interval toggles** — 13 chromatic steps from root to octave; each toggle shows the note name and its interval in short form below (3M, 3m, 4, 5, 7m, 8, etc.)
- **Direction selector** — controls the shape of each arpeggio run:
  - `Up` — root to top, then repeat
  - `Down` — top to root, then repeat
  - `Up & Down` — root to top, back to root, repeat
  - `Down & Up` — top to root, back to top, repeat

### 3. Preset Selector
Dropdown to auto-fill interval toggles and direction for common patterns:
- **Major scale root to fifth** *(most common vocal warm-up)* — intervals 1 2 3 4 5, direction: Up & Down
- **Fifth to root** *(slow descending)* — intervals 5 4 3 2 1, direction: Down
- Major triad, minor triad
- Major scale, natural minor, harmonic minor, melodic minor
- Diatonic modes, pentatonics

### 4. Tempo
- **BPM control** — numeric input; default **90 BPM**; fixed at quarter-note subdivision
- **Note gap** — each note sounds for `NOTE_GAP_RATIO` (85%) of the beat duration; the remaining 15% is silence to prevent oscillator overlap and click artifacts

### 5. Single Play
- **▶ Play once** button plays the current arpeggio (with countdown) one time, then stops
- Separate from auto-play; both share the same scheduler

### 6. Auto-Play Mode
Three `<select>` elements replace the range slider (HTML has no native dual-handle slider):
- **Lower limit** — lowest key the auto-play will descend to (default: **C3**)
- **Starting note** — key the first arpeggio runs from (default: **C4**)
- **Upper limit** — highest key the auto-play will ascend to (default: **C5**)

Defaults are tuned for a tenor (comfortable range C3–C5). All options are constrained to the configurable note range (C2–C6).

**Behavior:**
- Each completed arpeggio run → shift base key up a half-step
- When upper limit is reached → start descending by half-step per run
- When lower limit is reached → stop

### 7. Countdown
Metronome clicks prepend each arpeggio run, represented as `CLICK_NOTE = -1` sentinel values. The scheduler plays a short 1200 Hz tone for each without firing the UI `onNote` callback.

- **First run** (single play or first auto-play run): **4 clicks**
- **Inter-run** (between auto-play runs): **3 clicks** — keeps the bar count even
- On beat 1 of every countdown, the first scale note also plays at reduced volume (~40%) as a pitch anchor
- Single play: click × 4, arpeggio, stop
- Auto-play: click × 4, arpeggio, click × 3, arpeggio, …

### 8. Pitch Trainer (Microphone Input)

> **Temporarily removed.** Caused audio artifacts and arrow was not detecting reliably. Full design, known bugs, and reintroduction checklist documented in [context/pitch-trainer.md](../pitch-trainer.md).

---

## UI Layout

All controls sit below the main toggle row. Functional, not pretty — visual design is a future improvement.

```
(4)                  ↓
(2) [x] [ ] [ ] [ ] [x] [ ] [ ] [x] [ ] [ ] [ ] [ ] [x]
(3)  C   C#  D   D#  E   F   F#  G   G#  A   A#  B   C
     1   b2  2   b3  3M  4   b5  5   b6  6   b7  7   8
(5)                 ↑

[Root C ▾] [4 ▾]  [▶ Play once]  [Preset ▾]  [Up & Down ▾]

[BPM: 90]

[Lower: C3 ▾]  [Start: C4 ▾]  [Upper: C5 ▾]  [Play ▶ (auto)]

[🎤 Pitch trainer: OFF]
```

1. **Root note selector** — below the toggle row
2. **13 interval toggles** — root to octave; active toggles are included in the arpeggio pattern
3. **Toggle labels** — note name + interval short-form below; both update when root changes
4. **Current note marker** (`↓`) — appears above the active toggle during playback
5. **Live pitch marker** (`↑`) — appears below the row; moves at sub-semitone resolution (6 positions per half-step, i.e. ~17 cents each) so the singer can perceive and correct fine intonation errors

---

## Technical Notes

### Note Range
Configurable in code via a constant in `config.ts` (default **C2–C6**, covering 48 semitones / 4 octaves). All selects and auto-play limits are constrained to this range.

### Auto-Play Defaults
Also in `config.ts` — default lower/start/upper for a tenor: **C3 / C4 / C5**.

### Pitch Marker Resolution
With 12 half-steps × 6 sub-positions = **72 discrete positions** across the toggle row. Each sub-position ≈ 17 cents.

---

## Build Order

1. **Project setup** — Vite + TypeScript + SCSS, `config.ts`, `notes.ts`
2. **Sound engine** — `synth.ts`, note frequencies, envelope shaping
3. **Arpeggio logic** — `intervals.ts`, `arpeggio.ts`, `scheduler.ts`, direction modes, tempo/subdivision
4. **UI skeleton** — `toggle-row.ts`, `root-selector.ts`, `preset-selector.ts`, `direction-selector.ts`, `tempo-controls.ts`
5. **Playback markers** — current note `↓` indicator in toggle row
6. **Auto-play** — `auto-play.ts`, lower/start/upper selects, half-step stepping logic
7. **Pitch detection** — `pitch-detector.ts` AudioWorklet + YIN, `pitch-trainer.ts` UI, live `↑` marker

---

## Future Improvements

- **Refined synth sound** — model a more pleasant instrument (e.g. electric piano): layer harmonics, add subtle chorus/reverb, tune the envelope for a more musical feel
- **UI design** — replace the functional-but-ugly layout with a proper visual design: custom toggle styling, smooth marker animations, coherent typography and spacing
