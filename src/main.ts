import { Synth } from './audio/synth.js'
import { Scheduler } from './audio/scheduler.js'
import type { PreviewInfo } from './audio/scheduler.js'
import { buildSequence } from './music/arpeggio.js'
import { CLICK_NOTE, COUNTDOWN_BEATS } from './config.js'
import { noteIndexToFrequency } from './music/notes.js'
import { PRESETS } from './music/presets.js'
import { ToggleRow } from './ui/toggle-row.js'
import { RootSelector } from './ui/root-selector.js'
import { PresetSelector } from './ui/preset-selector.js'
import { DirectionSelector } from './ui/direction-selector.js'
import { TempoControls } from './ui/tempo-controls.js'
import { AutoPlay } from './ui/auto-play.js'

// ---------------------------------------------------------------------------
// Instantiate UI modules
// ---------------------------------------------------------------------------

const toggleRow        = new ToggleRow()
const rootSelector     = new RootSelector()
const presetSelector   = new PresetSelector()
const directionSelector = new DirectionSelector()
const tempoControls    = new TempoControls()
const autoPlay         = new AutoPlay()

// ---------------------------------------------------------------------------
// Audio — created lazily on first user gesture
// ---------------------------------------------------------------------------

let synth: Synth | null = null
let scheduler: Scheduler | null = null

/** 'single' = playing one run then stopping; 'auto' = auto-play stepping mode. */
let playMode: 'single' | 'auto' | null = null

// Initial root from the root selector (C4 = 24)
let currentRootIndex: number = rootSelector.getValue()

// ---------------------------------------------------------------------------
// Audio init
// ---------------------------------------------------------------------------

function ensureAudio(): void {
  if (synth === null) {
    synth      = new Synth()
    scheduler  = new Scheduler(synth)
  }
}

// ---------------------------------------------------------------------------
// Sequence helpers
// ---------------------------------------------------------------------------

/** Prepends `countdownBeats` click notes then the arpeggio sequence. */
function buildCurrentSequence(countdownBeats = COUNTDOWN_BEATS): number[] {
  const countdown = Array<number>(countdownBeats).fill(CLICK_NOTE)
  const notes     = buildSequence(
    currentRootIndex,
    toggleRow.getActiveIntervals(),
    directionSelector.getValue(),
  )
  return [...countdown, ...notes]
}

function rebuildSequence(countdownBeats = COUNTDOWN_BEATS): void {
  if (scheduler === null) return
  scheduler.updateSequence(buildCurrentSequence(countdownBeats), buildPreviewInfo(countdownBeats))
}

/** Returns preview info: play first scale note quietly on the last countdown beat only. */
function buildPreviewInfo(countdownBeats = COUNTDOWN_BEATS): PreviewInfo | null {
  const notes = buildSequence(currentRootIndex, toggleRow.getActiveIntervals(), directionSelector.getValue())
  if (notes.length === 0) return null
  return { noteIndex: notes[0], atPosition: 0 }
}

// ---------------------------------------------------------------------------
// Playback helpers
// ---------------------------------------------------------------------------

const playBtn       = document.getElementById('play-btn') as HTMLButtonElement | null
const autoplayBtn   = document.getElementById('autoplay-btn') as HTMLButtonElement | null
const presetSelectEl = document.getElementById('preset-select') as HTMLSelectElement | null

// All controls that should be locked while audio is playing
const lockableControls = Array.from(
  document.querySelectorAll<HTMLSelectElement | HTMLInputElement>('select, input[type="number"]'),
)

function setControlsLocked(locked: boolean): void {
  for (const el of lockableControls) el.disabled = locked
}

function updatePlayButtons(): void {
  const hasNotes = toggleRow.getActiveIntervals().length > 0
  if (playBtn !== null)     playBtn.disabled     = !hasNotes
  if (autoplayBtn !== null) autoplayBtn.disabled = !hasNotes
}

function onNoteCallback(noteIndex: number): void {
  toggleRow.setPlaybackMarker(noteIndex - currentRootIndex)
}

function stopPlayback(): void {
  playMode = null
  if (scheduler !== null) scheduler.stop()
  toggleRow.setPlaybackMarker(null)
  setControlsLocked(false)
  updatePlayButtons()
  if (playBtn !== null) {
    playBtn.textContent = '▶ Play once'
    playBtn.classList.remove('is-playing')
  }
}

function startSinglePlay(): void {
  if (synth === null || scheduler === null) return
  playMode = 'single'
  setControlsLocked(true)
  if (playBtn !== null) {
    playBtn.textContent = '■ Stop'
    playBtn.classList.add('is-playing')
  }
  scheduler.start(
    buildCurrentSequence(),
    tempoControls.getBpm(),
    tempoControls.getSubdivision(),
    onNoteCallback,
    () => {
      // Single run complete — clear marker and stop
      toggleRow.setPlaybackMarker(null)
      stopPlayback()
    },
    buildPreviewInfo(),
  )
}

function startAutoPlay(): void {
  if (synth === null || scheduler === null) return
  playMode = 'auto'
  setControlsLocked(true)
  scheduler.start(
    buildCurrentSequence(),
    tempoControls.getBpm(),
    tempoControls.getSubdivision(),
    onNoteCallback,
    () => {
      toggleRow.setPlaybackMarker(null)
      const newRoot = autoPlay.notifyRunEnd(currentRootIndex)
      if (newRoot !== currentRootIndex) {
        currentRootIndex = newRoot
        rootSelector.setValue(newRoot)
        toggleRow.updateLabels(newRoot)
      }
      // Inter-run countdown is 3 beats (keeps bar count even)
      rebuildSequence(3)
    },
    buildPreviewInfo(),
  )
}

// ---------------------------------------------------------------------------
// Single play button
// ---------------------------------------------------------------------------

if (playBtn !== null) {
  playBtn.addEventListener('click', () => {
    ensureAudio()
    if (scheduler !== null && scheduler.isPlaying) {
      stopPlayback()
    } else {
      startSinglePlay()
    }
  })
}

// ---------------------------------------------------------------------------
// Auto-play button (capture phase so it fires before AutoPlay's own listener)
// ---------------------------------------------------------------------------

if (autoplayBtn !== null) {
  autoplayBtn.addEventListener('click', () => {
    ensureAudio()
    if (scheduler !== null && scheduler.isPlaying) {
      stopPlayback()
    } else {
      // Always start from the configured starting note
      currentRootIndex = autoPlay.getStart()
      rootSelector.setValue(currentRootIndex)
      toggleRow.updateLabels(currentRootIndex)
      startAutoPlay()
    }
  }, { capture: true })
}

autoPlay.bind(
  // onStop: auto-play reached the lower limit
  () => { stopPlayback() },
)

// ---------------------------------------------------------------------------
// Wire UI change events
// ---------------------------------------------------------------------------

rootSelector.onChange((noteIndex) => {
  currentRootIndex = noteIndex
  toggleRow.updateLabels(currentRootIndex)
  rebuildSequence()
})

toggleRow.onChange(() => {
  rebuildSequence()
  updatePlayButtons()
})

toggleRow.onUserToggleOn((semitone) => {
  ensureAudio()
  const ctx  = synth!.getAudioContext()
  const freq = noteIndexToFrequency(currentRootIndex + semitone)
  synth!.scheduleNote(ctx, freq, 1.5, ctx.currentTime + 0.01)
})

toggleRow.onUserChange(() => {
  if (presetSelectEl !== null) presetSelectEl.value = ''
})
directionSelector.onChange(() => { rebuildSequence() })

presetSelector.onChange((preset) => {
  toggleRow.setActiveIntervals(preset.intervals)
  directionSelector.setValue(preset.direction)
  rebuildSequence()
})

tempoControls.onBpmChange(() => {
  if (scheduler === null || !scheduler.isPlaying) return
  if (playMode === 'single') startSinglePlay()
  else if (playMode === 'auto') startAutoPlay()
})


// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

// Apply default preset (Major scale root to fifth)
const defaultPreset = PRESETS[0]
toggleRow.setActiveIntervals(defaultPreset.intervals)
directionSelector.setValue(defaultPreset.direction)
if (presetSelectEl !== null) presetSelectEl.value = '0'

toggleRow.updateLabels(currentRootIndex)
updatePlayButtons()
