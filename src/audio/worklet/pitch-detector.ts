/// <reference lib="dom" />

// AudioWorkletProcessor global declarations (not in standard DOM lib)
declare const sampleRate: number;

declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort;
  abstract process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean;
}

declare function registerProcessor(
  name: string,
  processorCtor: new () => AudioWorkletProcessor
): void;

// ---------------------------------------------------------------------------
// YIN pitch detection constants
// ---------------------------------------------------------------------------

const BUFFER_SIZE = 2048;       // samples — balances latency vs. accuracy for vocals
const YIN_THRESHOLD = 0.15;     // aperiodicity threshold (lower = stricter)
const MIN_FREQUENCY = 80;       // Hz — bottom of human vocal range
const MAX_FREQUENCY = 1100;     // Hz — top of human vocal range

// ---------------------------------------------------------------------------
// YIN algorithm helpers
// ---------------------------------------------------------------------------

/**
 * Step 1 — Difference function.
 *
 * d(τ) = Σ (x[j] - x[j+τ])²  for j = 0 .. (W/2 - 1)
 * where W = bufferSize.  Only the first half of the buffer is used as the
 * "lag window" so that every lag τ has a full set of valid samples.
 */
function differenceFunction(
  buffer: Float32Array,
  yinBuffer: Float32Array
): void {
  const halfLen = yinBuffer.length; // BUFFER_SIZE / 2

  for (let tau = 0; tau < halfLen; tau++) {
    let sum = 0;
    for (let j = 0; j < halfLen; j++) {
      const delta = buffer[j] - buffer[j + tau];
      sum += delta * delta;
    }
    yinBuffer[tau] = sum;
  }
}

/**
 * Step 2 — Cumulative mean normalised difference function (CMNDF).
 *
 * d'(0) = 1  (by definition)
 * d'(τ) = d(τ) / ((1/τ) · Σ d(j)  for j = 1..τ)
 *
 * Rewritten to avoid a division inside the inner accumulation:
 *   d'(τ) = d(τ) · τ / Σ d(j)
 *
 * The result is written back into `yinBuffer` in-place.
 */
function cumulativeMeanNormalisedDifference(yinBuffer: Float32Array): void {
  yinBuffer[0] = 1;
  let runningSum = 0;

  for (let tau = 1; tau < yinBuffer.length; tau++) {
    runningSum += yinBuffer[tau];
    if (runningSum === 0) {
      yinBuffer[tau] = 1; // guard against silent input
    } else {
      yinBuffer[tau] = (yinBuffer[tau] * tau) / runningSum;
    }
  }
}

/**
 * Step 3 — Absolute threshold.
 *
 * Walk the CMNDF values starting at τ = 2 and return the first τ where the
 * value dips below the threshold, provided the value is at a local minimum
 * (i.e. already past the rising edge of the dip).  If no such τ is found,
 * return the global minimum as a fallback.
 */
function absoluteThreshold(yinBuffer: Float32Array): number {
  let minTau = -1;
  let minValue = Infinity;

  for (let tau = 2; tau < yinBuffer.length; tau++) {
    if (yinBuffer[tau] < YIN_THRESHOLD) {
      // Keep going while still descending so we land at the trough.
      while (tau + 1 < yinBuffer.length && yinBuffer[tau + 1] < yinBuffer[tau]) {
        tau++;
      }
      return tau;
    }

    if (yinBuffer[tau] < minValue) {
      minValue = yinBuffer[tau];
      minTau = tau;
    }
  }

  // Fallback: return the global minimum (pitch will be discarded by the
  // frequency-range check if confidence is truly too low).
  return minTau;
}

/**
 * Step 4 — Parabolic interpolation.
 *
 * Refine the integer lag estimate `tau` to sub-sample accuracy by fitting a
 * parabola through the three points (τ-1, d'(τ-1)), (τ, d'(τ)), (τ+1, d'(τ+1)).
 *
 * The vertex of the parabola gives the fractional offset:
 *   offset = (d'(τ-1) - d'(τ+1)) / (2 · (d'(τ-1) - 2·d'(τ) + d'(τ+1)))
 */
function parabolicInterpolation(yinBuffer: Float32Array, tau: number): number {
  if (tau < 1 || tau >= yinBuffer.length - 1) {
    return tau;
  }

  const prev = yinBuffer[tau - 1];
  const curr = yinBuffer[tau];
  const next = yinBuffer[tau + 1];
  const denominator = prev - 2 * curr + next;

  if (denominator === 0) {
    return tau;
  }

  const offset = (prev - next) / (2 * denominator);

  // Clamp to ±1 sample to avoid wild extrapolation.
  return tau + Math.max(-1, Math.min(1, offset));
}

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

/** Run YIN every N buffer fills to reduce audio-thread CPU load (~10 Hz at 44100). */
const PROCESS_EVERY_N_FILLS = 2;

class PitchDetectorProcessor extends AudioWorkletProcessor {
  /** Circular input buffer (accumulates samples across process() calls). */
  private readonly _inputBuffer: Float32Array = new Float32Array(BUFFER_SIZE);
  /** Working buffer for YIN intermediate values (length = BUFFER_SIZE / 2). */
  private readonly _yinBuffer: Float32Array = new Float32Array(BUFFER_SIZE / 2);
  /** Number of samples written into `_inputBuffer` so far in the current frame. */
  private _writeIndex: number = 0;
  /** How many times the buffer has been filled since the last YIN run. */
  private _fillCount: number = 0;

  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0];

    // No audio connected — keep the processor alive.
    if (input == null || input.length === 0) {
      return true;
    }

    const channel = input[0];

    if (channel == null || channel.length === 0) {
      return true;
    }

    // Fill the internal ring buffer one process() quantum at a time.
    for (let i = 0; i < channel.length; i++) {
      this._inputBuffer[this._writeIndex++] = channel[i];

      if (this._writeIndex >= BUFFER_SIZE) {
        this._writeIndex = 0;
        this._fillCount++;
        // Only run the expensive YIN pipeline every N fills
        if (this._fillCount >= PROCESS_EVERY_N_FILLS) {
          this._fillCount = 0;
          this._detectAndPost();
        }
      }
    }

    return true;
  }

  private _detectAndPost(): void {
    const frequency = this._yin(this._inputBuffer);
    this.port.postMessage({ type: 'pitch', frequency });
  }

  /** Run the full YIN pipeline on `buffer` and return Hz or null. */
  private _yin(buffer: Float32Array): number | null {
    // Step 1: difference function → _yinBuffer
    differenceFunction(buffer, this._yinBuffer);

    // Step 2: cumulative mean normalised difference → _yinBuffer (in-place)
    cumulativeMeanNormalisedDifference(this._yinBuffer);

    // Step 3: absolute threshold → best integer lag τ
    const tau = absoluteThreshold(this._yinBuffer);

    if (tau === -1) {
      return null; // completely silent or no periodic content found
    }

    // Step 4: parabolic interpolation → fractional τ
    const refinedTau = parabolicInterpolation(this._yinBuffer, tau);

    if (refinedTau <= 0) {
      return null;
    }

    // Step 5: convert lag to frequency
    const frequency = sampleRate / refinedTau;

    // Only report pitches within the human vocal range.
    if (frequency < MIN_FREQUENCY || frequency > MAX_FREQUENCY) {
      return null;
    }

    return frequency;
  }
}

registerProcessor('pitch-detector', PitchDetectorProcessor);
