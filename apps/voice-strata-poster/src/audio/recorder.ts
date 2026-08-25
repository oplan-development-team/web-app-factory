import { autoCorrelate, hzToSemitone } from './pitch';
import type { RawSample } from '../types';

export const MAX_RECORDING_SEC = 90;
export const MIN_RECORDING_SEC = 3;

const SUB_TICK_MS = 50;
const TICKS_PER_SAMPLE = 4; // 4 * 50ms = 200ms aggregated samples
const SILENCE_RMS_GATE = 0.012;
const SILENCE_HOLD_TICKS = 4; // ~200ms of continuous quiet before a tick counts as "silent"

export type RecorderErrorKind = 'permission-denied' | 'no-device' | 'unknown';

export class RecorderError extends Error {
  kind: RecorderErrorKind;
  constructor(kind: RecorderErrorKind, message: string) {
    super(message);
    this.kind = kind;
    this.name = 'RecorderError';
  }
}

export interface RecorderCallbacks {
  /** Fired roughly every 50ms while recording, for live meter/waveform UI. */
  onLevelTick?: (rms: number, elapsedSec: number) => void;
  /** Fired once the recording hits MAX_RECORDING_SEC and auto-stops. */
  onAutoStop?: () => void;
}

/**
 * Wraps getUserMedia + AudioContext + AnalyserNode to produce a stream of
 * RawSample values at ~200ms resolution (RMS volume, estimated F0, and a
 * pitch-jitter proxy) entirely in-browser. No audio is recorded/stored —
 * only these numeric measurements are kept.
 */
export class VoiceRecorder {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private buffer: Float32Array = new Float32Array(2048);
  private intervalId: number | null = null;
  private startedAt = 0;
  private subTickCount = 0;
  private pitchAccum: number[] = [];
  private rmsAccum: number[] = [];
  private silentStreak = 0;
  private samples: RawSample[] = [];
  private callbacks: RecorderCallbacks;
  private stopped = false;

  constructor(callbacks: RecorderCallbacks = {}) {
    this.callbacks = callbacks;
  }

  static isSupported(): boolean {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  async start(): Promise<void> {
    if (!VoiceRecorder.isSupported()) {
      throw new RecorderError('unknown', 'このブラウザは録音入力(getUserMedia)に対応していません。');
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const name = (err as { name?: string })?.name ?? '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
        throw new RecorderError('permission-denied', 'マイクへのアクセスが許可されませんでした。');
      }
      if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
        throw new RecorderError('no-device', '利用可能なマイクデバイスが見つかりませんでした。');
      }
      throw new RecorderError('unknown', 'マイクの初期化中に不明なエラーが発生しました。');
    }

    const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioContextCtor();
    const source = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.buffer = new Float32Array(this.analyser.fftSize);
    source.connect(this.analyser);

    this.startedAt = performance.now();
    this.subTickCount = 0;
    this.pitchAccum = [];
    this.rmsAccum = [];
    this.silentStreak = 0;
    this.samples = [];
    this.stopped = false;

    this.intervalId = window.setInterval(() => this.tick(), SUB_TICK_MS);
  }

  private tick(): void {
    if (!this.analyser || this.stopped) return;
    const elapsedSec = (performance.now() - this.startedAt) / 1000;

    this.analyser.getFloatTimeDomainData(this.buffer);

    let sumSq = 0;
    for (let i = 0; i < this.buffer.length; i++) sumSq += this.buffer[i] * this.buffer[i];
    const rms = Math.min(1, Math.sqrt(sumSq / this.buffer.length) * 4); // scaled for a livelier meter

    this.callbacks.onLevelTick?.(rms, elapsedSec);

    const f0 = autoCorrelate(this.buffer, this.ctx!.sampleRate);
    this.rmsAccum.push(rms);
    if (f0 > 0) this.pitchAccum.push(f0);

    if (rms < SILENCE_RMS_GATE) {
      this.silentStreak++;
    } else {
      this.silentStreak = 0;
    }

    this.subTickCount++;
    if (this.subTickCount >= TICKS_PER_SAMPLE) {
      this.flushSample(elapsedSec);
      this.subTickCount = 0;
    }

    if (elapsedSec >= MAX_RECORDING_SEC) {
      this.callbacks.onAutoStop?.();
    }
  }

  private flushSample(elapsedSec: number): void {
    const avgRms = this.rmsAccum.reduce((a, b) => a + b, 0) / Math.max(1, this.rmsAccum.length);
    const silent = this.silentStreak >= SILENCE_HOLD_TICKS || this.pitchAccum.length === 0;

    let f0: number | null = null;
    let jitterSemitones = 0;
    if (this.pitchAccum.length > 0) {
      f0 = this.pitchAccum.reduce((a, b) => a + b, 0) / this.pitchAccum.length;
      if (this.pitchAccum.length > 1) {
        const semis = this.pitchAccum.map(hzToSemitone);
        const mean = semis.reduce((a, b) => a + b, 0) / semis.length;
        const variance = semis.reduce((a, b) => a + (b - mean) ** 2, 0) / semis.length;
        jitterSemitones = Math.sqrt(variance);
      }
    }

    this.samples.push({ t: elapsedSec, rms: avgRms, f0: silent ? null : f0, jitterSemitones, silent });
    this.pitchAccum = [];
    this.rmsAccum = [];
  }

  /** Stops capture and returns the collected raw samples. Safe to call once. */
  stop(): RawSample[] {
    if (this.stopped) return this.samples;
    this.stopped = true;
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    // Flush any partial trailing sub-samples so short recordings aren't lost.
    if (this.rmsAccum.length > 0) {
      this.flushSample((performance.now() - this.startedAt) / 1000);
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    this.ctx?.close().catch(() => {});
    return this.samples;
  }
}
