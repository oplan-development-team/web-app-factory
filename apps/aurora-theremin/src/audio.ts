import {
  dbToLinear,
  speedToVibratoDepthCents,
  speedToVibratoRateHz,
  speedToFilterCutoff,
} from './mapping';

const ATTACK_S = 0.02;
const RELEASE_S = 0.07;
const SMOOTH_TIME_CONSTANT = 0.025;

/**
 * One theremin voice: oscillator -> lowpass filter -> continuous level gain
 * -> note on/off envelope gain -> destination. Every parameter change is
 * scheduled with AudioParam ramps/setTargetAtTime so nothing clicks or
 * zippers, even though updates arrive every animation frame.
 */
export class Voice {
  private ctx: AudioContext;
  private osc: OscillatorNode;
  private filter: BiquadFilterNode;
  private levelGain: GainNode;
  private ampGain: GainNode;
  private vibratoOsc: OscillatorNode;
  private vibratoDepth: GainNode;
  private isSounding = false;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;

    this.osc = ctx.createOscillator();
    this.osc.type = 'sine';
    this.osc.frequency.value = 220;

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 2000;
    this.filter.Q.value = 0.6;

    this.levelGain = ctx.createGain();
    this.levelGain.gain.value = 0.0001;

    this.ampGain = ctx.createGain();
    this.ampGain.gain.value = 0;

    this.vibratoOsc = ctx.createOscillator();
    this.vibratoOsc.type = 'sine';
    this.vibratoOsc.frequency.value = 5;
    this.vibratoDepth = ctx.createGain();
    this.vibratoDepth.gain.value = 0;
    this.vibratoOsc.connect(this.vibratoDepth);
    this.vibratoDepth.connect(this.osc.detune);

    this.osc.connect(this.filter);
    this.filter.connect(this.levelGain);
    this.levelGain.connect(this.ampGain);
    this.ampGain.connect(destination);

    this.osc.start();
    this.vibratoOsc.start();
  }

  get sounding(): boolean {
    return this.isSounding;
  }

  noteOn(): void {
    if (this.isSounding) return;
    this.isSounding = true;
    const now = this.ctx.currentTime;
    this.ampGain.gain.cancelScheduledValues(now);
    this.ampGain.gain.setValueAtTime(this.ampGain.gain.value, now);
    this.ampGain.gain.linearRampToValueAtTime(1, now + ATTACK_S);
  }

  noteOff(): void {
    if (!this.isSounding) return;
    this.isSounding = false;
    const now = this.ctx.currentTime;
    this.ampGain.gain.cancelScheduledValues(now);
    this.ampGain.gain.setValueAtTime(this.ampGain.gain.value, now);
    this.ampGain.gain.linearRampToValueAtTime(0, now + RELEASE_S);
  }

  /** Continuous parameter update while the gesture is held. speedNorm in [0,1]. */
  update(freqHz: number, gainDb: number, speedNorm: number): void {
    const now = this.ctx.currentTime;
    this.osc.frequency.setTargetAtTime(freqHz, now, SMOOTH_TIME_CONSTANT);
    this.levelGain.gain.setTargetAtTime(dbToLinear(gainDb), now, SMOOTH_TIME_CONSTANT);
    this.vibratoOsc.frequency.setTargetAtTime(speedToVibratoRateHz(speedNorm), now, 0.08);
    this.vibratoDepth.gain.setTargetAtTime(speedToVibratoDepthCents(speedNorm), now, 0.08);
    this.filter.frequency.setTargetAtTime(speedToFilterCutoff(speedNorm), now, 0.08);
  }

  dispose(): void {
    try {
      this.osc.stop();
      this.vibratoOsc.stop();
    } catch {
      // already stopped
    }
    this.osc.disconnect();
    this.vibratoOsc.disconnect();
    this.vibratoDepth.disconnect();
    this.filter.disconnect();
    this.levelGain.disconnect();
    this.ampGain.disconnect();
  }
}

/** Owns the AudioContext and one Voice per performer (live + loop layers). */
export class ThereminEngine {
  readonly ctx: AudioContext;
  readonly liveVoice: Voice;
  readonly layerVoices: Voice[];
  private compressor: DynamicsCompressorNode;
  private master: GainNode;

  constructor(layerCount = 3) {
    const AudioContextCtor: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioContextCtor();

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -20;
    this.compressor.knee.value = 14;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.005;
    this.compressor.release.value = 0.15;

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;

    this.compressor.connect(this.master);
    this.master.connect(this.ctx.destination);

    this.liveVoice = new Voice(this.ctx, this.compressor);
    this.layerVoices = Array.from({ length: layerCount }, () => new Voice(this.ctx, this.compressor));
  }

  async resume(): Promise<void> {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }
}
