// ecg-canvas.js
// Real-time ECG-style waveform renderer driven purely by keydown timing.
// No text content is ever read here — only numeric intensities per spike.

const COLOR_TRACE = "#39ff6a";
const COLOR_GLOW = "rgba(57, 255, 106, 0.55)";

/** Shape of a single QRS-like complex as a function of ms-since-trigger.
 *  Returns a value roughly in [-0.35, 1] scaled by `intensity` (0..1).
 *  Sharper / taller for higher intensity (i.e. shorter preceding interval). */
function qrsSample(te, intensity) {
  if (te < 0 || te > 190 || intensity <= 0) return 0;

  const amp = intensity;

  // Q dip
  if (te < 14) {
    return lerp(0, -0.12 * amp, te / 14);
  }
  // R rising edge (sharp)
  if (te < 26) {
    return lerp(-0.12 * amp, 1.0 * amp, (te - 14) / 12);
  }
  // R falling edge into S
  if (te < 42) {
    return lerp(1.0 * amp, -0.28 * amp, (te - 26) / 16);
  }
  // S recovery back toward baseline
  if (te < 65) {
    return lerp(-0.28 * amp, 0, (te - 42) / 23);
  }
  // brief isoelectric segment
  if (te < 95) {
    return 0;
  }
  // T wave: gentle rounded hump
  if (te < 175) {
    const p = (te - 95) / 80; // 0..1
    return Math.sin(p * Math.PI) * 0.16 * amp;
  }
  return 0;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export class EcgTrace {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.spikes = []; // {start: performTimeMs, intensity: 0..1}
    this.buffer = [];
    this.maxBuffer = 480;
    this.running = false;
    this._raf = null;
    this._lastTs = null;
    this._noisePhase = Math.random() * 1000;
    this._resizeForDpr();
    this._onResize = () => this._resizeForDpr();
    window.addEventListener("resize", this._onResize);
  }

  _resizeForDpr() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(rect.width || this.canvas.clientWidth || 600, 200);
    const h = Math.max(rect.height || this.canvas.clientHeight || 220, 120);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cssWidth = w;
    this.cssHeight = h;
  }

  /** Register a new heartbeat-like spike. intensity in [0,1]. */
  addSpike(intensity) {
    this.spikes.push({ start: performance.now(), intensity: Math.max(0, Math.min(1, intensity)) });
    // keep spike list bounded
    if (this.spikes.length > 24) this.spikes.shift();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._lastTs = null;
    const loop = (ts) => {
      if (!this.running) return;
      this._tick(ts);
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
  }

  reset() {
    this.spikes = [];
    this.buffer = [];
  }

  destroy() {
    this.stop();
    window.removeEventListener("resize", this._onResize);
  }

  _currentValue(now) {
    let v = 0;
    for (const s of this.spikes) {
      const te = now - s.start;
      if (te >= 0 && te <= 190) {
        v += qrsSample(te, s.intensity);
      }
    }
    // ambient baseline jitter so the line never looks perfectly dead
    const t = (now + this._noisePhase) / 1000;
    const noise =
      Math.sin(t * 2.3) * 0.012 + Math.sin(t * 5.1 + 1.4) * 0.006 + (Math.random() - 0.5) * 0.01;
    v += noise;
    return Math.max(-0.6, Math.min(1.05, v));
  }

  _tick(ts) {
    const now = performance.now();
    this.buffer.push(this._currentValue(now));
    if (this.buffer.length > this.maxBuffer) this.buffer.shift();
    this._draw();
  }

  _draw() {
    const { ctx, cssWidth: w, cssHeight: h } = this;
    ctx.clearRect(0, 0, w, h);

    const mid = h * 0.58;
    const scaleY = h * 0.42;
    const n = this.buffer.length;
    if (n < 2) return;

    const stepX = w / this.maxBuffer;
    const startX = w - n * stepX;

    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // soft glow pass
    ctx.shadowColor = COLOR_GLOW;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = COLOR_TRACE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = startX + i * stepX;
      const y = mid - this.buffer[i] * scaleY;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // crisp core line on top
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = "#c8ffd8";
    ctx.globalAlpha = 0.9;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // leading dot (the "pen tip")
    const lastX = startX + (n - 1) * stepX;
    const lastY = mid - this.buffer[n - 1] * scaleY;
    ctx.shadowColor = COLOR_GLOW;
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#eaffef";
    ctx.beginPath();
    ctx.arc(lastX, lastY, 2.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Draw the current waveform snapshot into an arbitrary target context,
   * used for PNG export. Renders the same buffer at a given rect.
   */
  drawSnapshotTo(targetCtx, x, y, w, h) {
    const mid = y + h * 0.58;
    const scaleY = h * 0.42;
    const n = this.buffer.length;
    targetCtx.save();
    targetCtx.beginPath();
    targetCtx.rect(x, y, w, h);
    targetCtx.clip();

    if (n >= 2) {
      const stepX = w / this.maxBuffer;
      const startX = x + w - n * stepX;
      targetCtx.lineJoin = "round";
      targetCtx.lineCap = "round";
      targetCtx.shadowColor = COLOR_GLOW;
      targetCtx.shadowBlur = 10;
      targetCtx.strokeStyle = COLOR_TRACE;
      targetCtx.lineWidth = 2.2;
      targetCtx.beginPath();
      for (let i = 0; i < n; i++) {
        const px = startX + i * stepX;
        const py = mid - this.buffer[i] * scaleY;
        if (i === 0) targetCtx.moveTo(px, py);
        else targetCtx.lineTo(px, py);
      }
      targetCtx.stroke();
    }
    targetCtx.restore();
  }
}
