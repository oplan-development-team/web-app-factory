// Web Audio API による効果音の自前生成（外部音声アセット不使用）。
// オシレーター/ノイズバッファでヒット音・ダッシュ音・押し出され確定音を合成する。

export class SumoAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.masterGain = null;
  }

  /** ユーザー操作（クリック/キー押下）のタイミングで呼ぶこと。AutoplayPolicy対策。 */
  ensureContext() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 0.8;
    this.masterGain.connect(this.ctx.destination);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.02);
    }
  }

  _noiseBuffer(duration) {
    const ctx = this.ctx;
    const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      // 減衰する白色ノイズ
      const decay = 1 - i / sampleCount;
      data[i] = (Math.random() * 2 - 1) * decay;
    }
    return buffer;
  }

  /** 衝突時の打撃音（強さ0〜1で音量・ピッチが変化） */
  playHit(strength = 0.5) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const s = Math.min(1, Math.max(0.15, strength));

    // ノイズ成分（ドスッという打撃感）
    const noise = ctx.createBufferSource();
    noise.buffer = this._noiseBuffer(0.12);
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.value = 900 + s * 500;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.5 * s, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    noise.connect(noiseFilter).connect(noiseGain).connect(this.masterGain);
    noise.start(now);
    noise.stop(now + 0.14);

    // 低音の"ドン"（太鼓的な質感）
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(120 + s * 40, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.6 * s, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(oscGain).connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  /** 突っ張りダッシュ発動音（鋭い上昇音） */
  playDash() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.09);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain).connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  /** 押し出され確定音（下降するゴング風、余韻あり） */
  playOut() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    [1, 1.5, 2.01].forEach((mult, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? "triangle" : "sine";
      osc.frequency.setValueAtTime(180 * mult, now);
      osc.frequency.exponentialRampToValueAtTime(60 * mult, now + 0.6);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.28 / (i + 1), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7 + i * 0.1);
      osc.connect(gain).connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.8);
    });

    // アタック用の短いノイズ
    const noise = ctx.createBufferSource();
    noise.buffer = this._noiseBuffer(0.2);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.35, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    noise.connect(noiseGain).connect(this.masterGain);
    noise.start(now);
    noise.stop(now + 0.2);
  }

  /** カウントダウンの掛け声にあわせた軽いクリック音 */
  playTick() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(440, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain).connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }
}
