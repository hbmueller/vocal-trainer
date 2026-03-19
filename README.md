# Vocal Trainer

A browser-based vocal warm-up tool. Pick a scale pattern, set a key, and run arpeggios up and down your range while a metronome keeps you on time.

Built with vanilla TypeScript, Web Audio API, and Vite. No frameworks, no dependencies at runtime.

## Features

- 13 chromatic interval toggles (root to octave) with preset scales and triads
- Four arpeggio directions: up, down, up & down, down & up
- Tempo and subdivision control
- Single play (one run) and auto-play (steps up then down by half-step across a configurable range)
- 4-beat metronome countdown before each run

## Development

```sh
pnpm install
pnpm dev
```

## Build

```sh
pnpm build
```

Deployed to GitHub Pages at `/vocal-trainer/` on every push to `main`.
