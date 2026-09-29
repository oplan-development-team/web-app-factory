import { RESAMPLE_N, type Waveform } from './geometry';

export type PlaybackState = 'idle' | 'playing' | 'paused';

const MIN_HZ = 30;
const MAX_HZ = 600;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private splitter: ChannelSplitterNode | null = null;
  analyserL: AnalyserNode | null = null;
  analyserR: AnalyserNode | null = null;

  private frequency = 220;
  private volume = 0.6;
  private waveform: Waveform | null = null;
  state: PlaybackState = 'idle';

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.buffer = this.ctx.createBuffer(2, RESAMPLE_N, this.ctx.sampleRate);
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.value = this.volume;
      this.splitter = this.ctx.createChannelSplitter(2);
      this.analyserL = this.ctx.createAnalyser();
      this.analyserR = this.ctx.createAnalyser();
      this.analyserL.fftSize = 1024;
      this.analyserR.fftSize = 1024;
      this.analyserL.smoothingTimeConstant = 0;
      this.analyserR.smoothingTimeConstant = 0;

      this.gainNode.connect(this.ctx.destination);
      this.gainNode.connect(this.splitter);
      this.splitter.connect(this.analyserL, 0);
      this.splitter.connect(this.analyserR, 1);

      if (this.waveform) this.writeBuffer(this.waveform);
    }
    return this.ctx;
  }

  private writeBuffer(waveform: Waveform) {
    if (!this.buffer) return;
    this.buffer.copyToChannel(waveform.x as Float32Array<ArrayBuffer>, 0);
    this.buffer.copyToChannel(waveform.y as Float32Array<ArrayBuffer>, 1);
  }

  /** Update the loop geometry. Safe to call continuously while playing. */
  updateWaveform(waveform: Waveform) {
    this.waveform = waveform;
    if (this.buffer) this.writeBuffer(waveform);
  }

  setFrequency(hz: number) {
    this.frequency = Math.min(MAX_HZ, Math.max(MIN_HZ, hz));
    if (this.ctx && this.source) {
      const loopFreqAtRate1 = this.ctx.sampleRate / RESAMPLE_N;
      this.source.playbackRate.setTargetAtTime(
        this.frequency / loopFreqAtRate1,
        this.ctx.currentTime,
        0.01
      );
    }
  }

  getFrequency() {
    return this.frequency;
  }

  setVolume(v: number) {
    this.volume = Math.min(1, Math.max(0, v));
    if (this.ctx && this.gainNode) {
      this.gainNode.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.01);
    }
  }

  getVolume() {
    return this.volume;
  }

  async play() {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    if (this.state === 'playing') return;
    if (!this.source) {
      this.startSource();
    }
    this.state = 'playing';
  }

  private startSource() {
    if (!this.ctx || !this.buffer || !this.gainNode) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.loop = true;
    const loopFreqAtRate1 = this.ctx.sampleRate / RESAMPLE_N;
    src.playbackRate.value = this.frequency / loopFreqAtRate1;
    src.connect(this.gainNode);
    src.start();
    this.source = src;
  }

  async pause() {
    if (!this.ctx || this.state !== 'playing') return;
    await this.ctx.suspend();
    this.state = 'paused';
  }

  stop() {
    if (this.source) {
      try {
        this.source.stop();
      } catch {
        /* already stopped */
      }
      this.source.disconnect();
      this.source = null;
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => undefined);
    }
    this.state = 'idle';
  }

  /** RMS-based dB estimate from the live analysers, or -Infinity-safe floor. */
  getEstimatedDb(): number {
    if (!this.analyserL || !this.analyserR || this.state !== 'playing') return -60;
    const bufL = new Float32Array(this.analyserL.fftSize);
    const bufR = new Float32Array(this.analyserR.fftSize);
    this.analyserL.getFloatTimeDomainData(bufL);
    this.analyserR.getFloatTimeDomainData(bufR);
    let sum = 0;
    for (let i = 0; i < bufL.length; i++) {
      sum += bufL[i] * bufL[i] + bufR[i] * bufR[i];
    }
    const rms = Math.sqrt(sum / (bufL.length * 2));
    const db = 20 * Math.log10(Math.max(rms, 1e-5));
    return Math.max(-60, db);
  }

  getSampleRate(): number {
    return this.ctx?.sampleRate ?? 44100;
  }

  /** Render `durationSec` of the current loop offline for WAV export. */
  async renderOffline(durationSec: number): Promise<AudioBuffer> {
    const sampleRate = this.ctx?.sampleRate ?? 44100;
    const length = Math.ceil(sampleRate * durationSec);
    const offlineCtx = new OfflineAudioContext(2, length, sampleRate);
    const buf = offlineCtx.createBuffer(2, RESAMPLE_N, sampleRate);
    if (this.waveform) {
      buf.copyToChannel(this.waveform.x as Float32Array<ArrayBuffer>, 0);
      buf.copyToChannel(this.waveform.y as Float32Array<ArrayBuffer>, 1);
    }
    const src = offlineCtx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const loopFreqAtRate1 = sampleRate / RESAMPLE_N;
    src.playbackRate.value = this.frequency / loopFreqAtRate1;
    const gain = offlineCtx.createGain();
    gain.gain.value = this.volume;
    src.connect(gain);
    gain.connect(offlineCtx.destination);
    src.start();
    return offlineCtx.startRendering();
  }
}

export { MIN_HZ, MAX_HZ };
