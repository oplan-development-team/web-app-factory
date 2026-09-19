import type { CalibrationResult, MicErrorKind } from './types';

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export class AudioEngineError extends Error {
  kind: MicErrorKind;
  original?: unknown;
  constructor(kind: MicErrorKind, original?: unknown) {
    super(`mic-error:${kind}`);
    this.kind = kind;
    this.original = original;
  }
}

/**
 * Wraps getUserMedia + AnalyserNode RMS metering behind a small interface.
 *
 * Also supports a "simulated" mode (used only when the app is launched with
 * `?simulate=1`) that replaces the real microphone with a synthetic RMS
 * signal driven by holding Space / a pointer down. This exists purely as a
 * developer/QA aid for exercising the flame + wax physics and the wish
 * reveal without needing a real microphone in a headless/CI browser — it is
 * never surfaced in the normal UI and normal users never opt into it.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private buffer: Float32Array<ArrayBuffer> | null = null;

  private readonly simulated: boolean;
  private simLevel = 0;
  private simHeld = false;
  private simLastTick = performance.now();
  private simRafId = 0;
  private unbindSim: (() => void) | null = null;

  constructor(simulated = false) {
    this.simulated = simulated;
    if (simulated) {
      this.bindSimulationInputs();
      this.startSimLoop();
    }
  }

  async start(): Promise<void> {
    if (this.simulated) return;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
    } catch (err) {
      throw this.classifyError(err);
    }

    this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    const source = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0;
    source.connect(this.analyser);
    this.buffer = new Float32Array(this.analyser.fftSize);
  }

  private classifyError(err: unknown): AudioEngineError {
    const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: unknown }).name) : '';
    let kind: MicErrorKind = 'unknown';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
      kind = 'denied';
    } else if (
      name === 'NotFoundError' ||
      name === 'NotReadableError' ||
      name === 'OverconstrainedError' ||
      name === 'TrackStartError' ||
      name === 'AbortError'
    ) {
      kind = 'device';
    }
    return new AudioEngineError(kind, err);
  }

  /** Instantaneous RMS of the current audio frame, roughly in [0, 1]. */
  getRms(): number {
    if (this.simulated) return this.simLevel;
    if (!this.analyser || !this.buffer) return 0;
    this.analyser.getFloatTimeDomainData(this.buffer);
    let sumSquares = 0;
    for (let i = 0; i < this.buffer.length; i++) {
      const v = this.buffer[i];
      sumSquares += v * v;
    }
    return Math.sqrt(sumSquares / this.buffer.length);
  }

  /** Samples ambient RMS for `durationMs` and derives a blow threshold from it. */
  calibrate(durationMs: number, onProgress?: (ratio: number) => void): Promise<CalibrationResult> {
    const samples: number[] = [];
    const startedAt = performance.now();
    return new Promise((resolve) => {
      const tick = () => {
        const elapsed = performance.now() - startedAt;
        const ratio = clamp(elapsed / durationMs, 0, 1);
        samples.push(this.getRms());
        onProgress?.(ratio);
        if (elapsed < durationMs) {
          requestAnimationFrame(tick);
          return;
        }
        const mean = samples.reduce((a, b) => a + b, 0) / Math.max(1, samples.length);
        const variance = samples.reduce((a, b) => a + (b - mean) * (b - mean), 0) / Math.max(1, samples.length);
        const stddev = Math.sqrt(variance);
        const noiseFloor = Math.max(0.002, mean);
        const margin = Math.max(stddev * 3.2, 0.018);
        const threshold = clamp(noiseFloor + margin, 0.03, 0.4);
        resolve({ noiseFloor, threshold });
      };
      requestAnimationFrame(tick);
    });
  }

  stop(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close().catch(() => {});
    this.stream = null;
    this.ctx = null;
    this.analyser = null;
    this.buffer = null;
    this.unbindSim?.();
    if (this.simRafId) cancelAnimationFrame(this.simRafId);
  }

  // -- simulation helpers (only active when `simulated` is true) -----------

  private bindSimulationInputs(): void {
    const isTypingTarget = (e: Event) => {
      const t = e.target as HTMLElement | null;
      return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
    };
    // Deliberately keyboard-only (held Space), scoped away from text inputs:
    // this is a QA/dev aid only (`?simulate=1`), and binding to generic
    // `pointerdown` on the whole document would make every ordinary button
    // click (e.g. "relight") also register as a simulated blow. We also
    // preventDefault so a focused button doesn't additionally fire a native
    // click-via-Space (and the page doesn't scroll) while "blowing".
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isTypingTarget(e)) return;
      e.preventDefault();
      if (e.repeat) return;
      this.simHeld = true;
    };
    // The release handler intentionally ignores isTypingTarget: focus can
    // shift (e.g. the wish input autofocusing) between a Space keydown and
    // its matching keyup, and a dropped release must never leave simHeld
    // stuck "true" forever (an always-blowing candle scene).
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      this.simHeld = false;
    };
    document.addEventListener('keydown', down);
    document.addEventListener('keyup', up);
    this.unbindSim = () => {
      document.removeEventListener('keydown', down);
      document.removeEventListener('keyup', up);
    };
  }

  /**
   * Runs independently of whichever screen is active (unlike the real
   * AnalyserNode, which always reflects "right now" regardless of whether
   * anyone polled it). Without this, a simulated level from a previous
   * round could sit frozen while the wish/mode-select screens are shown
   * (since nothing calls getRms() there) and then read back as a stale
   * "still blowing" spike the instant a new round starts.
   */
  private startSimLoop(): void {
    const step = () => {
      const now = performance.now();
      const dt = clamp((now - this.simLastTick) / 1000, 0, 0.1);
      this.simLastTick = now;
      const target = this.simHeld ? 0.34 : 0.012;
      const rate = this.simHeld ? 6 : 4;
      this.simLevel += (target - this.simLevel) * clamp(dt * rate, 0, 1);
      this.simRafId = requestAnimationFrame(step);
    };
    this.simRafId = requestAnimationFrame(step);
  }
}
