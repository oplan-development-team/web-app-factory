/**
 * All sound effects are synthesized with the Web Audio API (oscillator +
 * gain envelope) — no audio files. The AudioContext is created lazily on
 * the first user gesture to satisfy browser autoplay policies.
 */
export class SfxEngine {
  private ctx: AudioContext | null = null;
  muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  /** Call on first user gesture to unlock audio without playing anything audible. */
  unlock(): void {
    this.ensureContext();
  }

  private tone(
    freq: number,
    startOffset: number,
    duration: number,
    type: OscillatorType,
    peakGain: number,
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const t0 = ctx.currentTime + startOffset;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(peakGain, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  /** Tactile key click — short, dry, high. */
  keyTick(): void {
    this.tone(720, 0, 0.045, 'square', 0.05);
  }

  /** A correct step within a trace sequence. */
  stepCorrect(): void {
    this.tone(520, 0, 0.08, 'triangle', 0.08);
  }

  /** Wrong key / broken sequence. */
  error(): void {
    this.tone(220, 0, 0.14, 'sawtooth', 0.09);
    this.tone(160, 0.05, 0.16, 'sawtooth', 0.08);
  }

  /** Lock springs open. */
  unlockSuccess(): void {
    this.tone(440, 0, 0.12, 'square', 0.07);
    this.tone(660, 0.09, 0.12, 'square', 0.07);
    this.tone(880, 0.18, 0.22, 'square', 0.08);
  }

  /** Vault door finale. */
  finale(): void {
    [261.6, 329.6, 392.0, 523.2, 659.2].forEach((f, i) => {
      this.tone(f, i * 0.09, 0.9, 'sawtooth', 0.045);
    });
    this.tone(65, 0, 1.4, 'sine', 0.12);
  }
}
