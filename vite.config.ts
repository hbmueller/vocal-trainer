import { defineConfig } from 'vite'

export default defineConfig({
  base: '/vocal-trainer/',
  build: {
    outDir: 'dist',
  },
  worker: {
    format: 'es',  // AudioWorklet requires ES module format
  },
})
