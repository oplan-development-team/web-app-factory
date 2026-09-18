import type { InkLayer } from '../ink/layer';
import type { ScaleName, TimbreBucket } from '../types';
import { yToFrequency } from './scales';

export const MAX_VOICES = 6;

interface Voice {
  oscA: OscillatorNode;
  oscB: OscillatorNode; // slightly detuned layer, only audible for the "saw" timbre bucket
  gainA: GainNode;
  gainB: GainNode;
  voiceGain: GainNode;
  active: boolean;
}

export interface ActiveVoiceInfo {
  yNorm: number;
  gainNorm: number; // 0..1, for the visual highlight
  timbre: TimbreBucket;
}

export interface FrameInfo {
  elapsedNorm: number; // 0..1 across the performance duration
  playheadX: number; // px within the ink area
  voices: ActiveVoiceInfo[];
}

export type FrameCallback = (info: FrameInfo) => void;
export type EndCallback = () => void;

function timbreFromDensity(density: number): TimbreBucket {
  if (density < 0.35) return 'sine';
  if (density < 0.7) return 'triangle';
  return 'saw';
}

function oscTypeFor(timbre: TimbreBucket): OscillatorType {
  if (timbre === 'sine') return 'sine';
  if (timbre === 'triangle') return 'triangle';
  return 'sawtooth';
}

/**
 * Scans an InkLayer's composite ink map left-to-right over a fixed
 * duration and drives a small pool of oscillator "voices" — this is the
 * entire audio engine. No samples, no external audio API: only
 * OscillatorNode / GainNode / DelayNode / DynamicsCompressorNode.
 */
export class ScoreAudioEngine {
  private ctx: AudioContext | null = null;
  private voices: Voice[] = [];
  private rafId: number | null = null;
  private playing = false;
  private startCtxTime = 0;
  private pausedElapsed = 0;
  private durationSec = 40;
  private loop = false;
  private scale: ScaleName = 'pentatonic';
  private inkLayer: InkLayer | null = null;
  private onFrame: FrameCallback | null = null;
  private onEnd: EndCallback | null = null;

  get isPlaying(): boolean {
    return this.playing;
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const ctx = new AudioContext();
      this.ctx = ctx;
      const master = ctx.createGain();
      master.gain.value = 0.9;
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.ratio.value = 4;

      // gentle feedback delay for an ambient sense of space — plain
      // DelayNode/GainNode routing, still oscillator-only sound sources.
      const delay = ctx.createDelay(1.5);
      delay.delayTime.value = 0.32;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.32;
      const wetGain = ctx.createGain();
      wetGain.gain.value = 0.25;

      master.connect(compressor);
      master.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(wetGain);
      wetGain.connect(compressor);
      compressor.connect(ctx.destination);

      for (let i = 0; i < MAX_VOICES; i++) {
        const oscA = ctx.createOscillator();
        const oscB = ctx.createOscillator();
        oscA.type = 'sine';
        oscB.type = 'sawtooth';
        oscB.detune.value = 9;
        const gainA = ctx.createGain();
        const gainB = ctx.createGain();
        gainA.gain.value = 1;
        gainB.gain.value = 0;
        const voiceGain = ctx.createGain();
        voiceGain.gain.value = 0;
        oscA.connect(gainA).connect(voiceGain);
        oscB.connect(gainB).connect(voiceGain);
        voiceGain.connect(master);
        oscA.frequency.value = 220;
        oscB.frequency.value = 220;
        oscA.start();
        oscB.start();
        this.voices.push({ oscA, oscB, gainA, gainB, voiceGain, active: false });
      }
    }
    return this.ctx;
  }

  start(opts: {
    inkLayer: InkLayer;
    scale: ScaleName;
    durationSec: number;
    loop: boolean;
    onFrame: FrameCallback;
    onEnd: EndCallback;
  }): void {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') void ctx.resume();
    this.inkLayer = opts.inkLayer;
    this.scale = opts.scale;
    this.durationSec = opts.durationSec;
    this.loop = opts.loop;
    this.onFrame = opts.onFrame;
    this.onEnd = opts.onEnd;
    this.pausedElapsed = 0;
    this.startCtxTime = ctx.currentTime;
    this.playing = true;
    this.tick();
  }

  setLoop(loop: boolean): void {
    this.loop = loop;
  }

  pause(): void {
    if (!this.playing || !this.ctx) return;
    this.pausedElapsed = this.ctx.currentTime - this.startCtxTime;
    this.playing = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.muteAll();
  }

  resume(): void {
    if (this.playing || !this.ctx) return;
    this.startCtxTime = this.ctx.currentTime - this.pausedElapsed;
    this.playing = true;
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    this.tick();
  }

  stop(): void {
    this.playing = false;
    this.pausedElapsed = 0;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.muteAll();
  }

  private muteAll(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const v of this.voices) {
      v.voiceGain.gain.setTargetAtTime(0, now, 0.05);
      v.active = false;
    }
  }

  private tick = (): void => {
    if (!this.playing || !this.ctx || !this.inkLayer) return;
    const now = this.ctx.currentTime;
    let elapsed = now - this.startCtxTime;

    if (elapsed >= this.durationSec) {
      if (this.loop) {
        this.startCtxTime = now;
        elapsed = 0;
      } else {
        this.muteAll();
        this.playing = false;
        this.onFrame?.({ elapsedNorm: 1, playheadX: this.inkLayer.w, voices: [] });
        this.onEnd?.();
        return;
      }
    }

    const elapsedNorm = Math.max(0, Math.min(1, elapsed / this.durationSec));
    const x = elapsedNorm * this.inkLayer.w;
    const blobs = this.inkLayer.sampleColumn(x, MAX_VOICES);

    const active: ActiveVoiceInfo[] = [];
    for (let i = 0; i < this.voices.length; i++) {
      const v = this.voices[i];
      const blob = blobs[i];
      if (!blob) {
        v.voiceGain.gain.setTargetAtTime(0, now, 0.12);
        v.active = false;
        continue;
      }
      const timbre = timbreFromDensity(blob.density);
      const freq = yToFrequency(blob.yCenter, this.scale);
      const thicknessNorm = Math.min(1, blob.thickness / 46);
      const gainTarget = 0.03 + thicknessNorm * 0.15;

      v.oscA.type = oscTypeFor(timbre);
      v.oscA.frequency.setTargetAtTime(freq, now, 0.06);
      v.oscB.frequency.setTargetAtTime(freq, now, 0.06);
      v.gainB.gain.setTargetAtTime(timbre === 'saw' ? 0.4 : 0, now, 0.08);
      v.voiceGain.gain.setTargetAtTime(gainTarget, now, 0.09);
      v.active = true;

      active.push({ yNorm: blob.yCenter, gainNorm: thicknessNorm, timbre });
    }

    this.onFrame?.({ elapsedNorm, playheadX: x, voices: active });
    this.rafId = requestAnimationFrame(this.tick);
  };

  dispose(): void {
    this.stop();
    if (this.ctx) {
      for (const v of this.voices) {
        try {
          v.oscA.stop();
          v.oscB.stop();
        } catch {
          /* already stopped */
        }
      }
      void this.ctx.close();
    }
    this.ctx = null;
    this.voices = [];
  }
}
