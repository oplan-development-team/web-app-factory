/**
 * All sound effects are synthesized at runtime with the Web Audio API —
 * no external audio files. Everything is built from oscillators and
 * generated noise buffers.
 */

type GunshotVariant = 'flying' | 'win';

function createNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export class SoundEngine {
  private ctx: AudioContext | null = null;

  /** Must be called from within a user-gesture handler to satisfy autoplay policy. */
  unlock(): void {
    this.getContext();
  }

  private getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  /** Gong/bell struck the instant the DRAW! sign appears. */
  playGong(): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.9, now);
    master.connect(ctx.destination);

    // Inharmonic partials give a metallic bell/gong character.
    const partials: [number, number][] = [
      [220, 1.4],
      [331, 1.1],
      [554, 0.8],
      [740, 0.5],
    ];
    for (const [freq, decay] of partials) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + decay);
      osc.connect(gain).connect(master);
      osc.start(now);
      osc.stop(now + decay + 0.05);
    }

    // Short high-passed noise "strike" transient for the mallet hit.
    const noise = ctx.createBufferSource();
    noise.buffer = createNoiseBuffer(ctx, 0.08);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1200;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.6, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    noise.connect(hp).connect(noiseGain).connect(master);
    noise.start(now);
    noise.stop(now + 0.08);
  }

  /** Gunshot — punishing/low for a flying (foul) shot, crisp/bright for a round win. */
  playGunshot(variant: GunshotVariant): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(1, now);
    master.connect(ctx.destination);

    const noise = ctx.createBufferSource();
    noise.buffer = createNoiseBuffer(ctx, 0.4);
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.setValueAtTime(variant === 'flying' ? 850 : 1500, now);
    band.Q.value = 0.6;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(1, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + (variant === 'flying' ? 0.32 : 0.22));
    noise.connect(band).connect(noiseGain).connect(master);
    noise.start(now);
    noise.stop(now + 0.4);

    const thump = ctx.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(variant === 'flying' ? 110 : 150, now);
    thump.frequency.exponentialRampToValueAtTime(35, now + 0.22);
    const thumpGain = ctx.createGain();
    thumpGain.gain.setValueAtTime(0.9, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    thump.connect(thumpGain).connect(master);
    thump.start(now);
    thump.stop(now + 0.3);

    if (variant === 'flying') {
      // Extra distorted rumble to make the foul feel like a penalty.
      const rumble = ctx.createOscillator();
      rumble.type = 'sawtooth';
      rumble.frequency.setValueAtTime(70, now);
      rumble.frequency.exponentialRampToValueAtTime(20, now + 0.5);
      const rumbleGain = ctx.createGain();
      rumbleGain.gain.setValueAtTime(0.35, now);
      rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      rumble.connect(rumbleGain).connect(master);
      rumble.start(now);
      rumble.stop(now + 0.6);
    } else {
      // Bright follow-up "ting" for a clean win.
      const ting = ctx.createOscillator();
      ting.type = 'triangle';
      ting.frequency.setValueAtTime(1760, now + 0.05);
      const tingGain = ctx.createGain();
      tingGain.gain.setValueAtTime(0.0001, now);
      tingGain.gain.setValueAtTime(0.25, now + 0.05);
      tingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      ting.connect(tingGain).connect(master);
      ting.start(now + 0.05);
      ting.stop(now + 0.32);
    }
  }

  /** Ascending chime for a new all-time-best record. */
  playRecord(): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const start = now + i * 0.09;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.4, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.38);
    });
  }
}
