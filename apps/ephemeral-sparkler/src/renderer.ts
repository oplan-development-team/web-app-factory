import { alphaAt, colorAt, type Particle } from './sparkler-physics.ts';
import type { WindState } from './wind.ts';

export interface Geometry {
  width: number;
  height: number;
  emberX: number;
  emberY: number;
  handX: number;
  handY: number;
}

interface StickWiggle {
  t: number;
  offset: number;
}

const BG_COLOR = '#0a0806';
const PAPER_COLOR = '#7a6444';
const PAPER_HIGHLIGHT = '#c9a86a';

// A real 線香花火 is held with the twisted-paper grip at the TOP, between the
// fingers, with the ember hanging DOWN under it — that drooping silhouette is
// the toy's whole visual signature. handY sits near the top of the screen,
// emberY well below it, leaving open space further down for the burst and
// falling sparks (gravity keeps pulling them away from the grip, unchanged).
const GRIP_Y_RATIO = 0.16;
const EMBER_Y_RATIO = 0.46;

/** Short rolling "shutter" window for the afterglow export — see resetAfterglow/fadeAfterglow. */
const AFTERGLOW_WINDOW_SECONDS = 1.5;

// Wind sway on the stick itself (see drawStick): about 6x the hand-drawn
// wiggle's own amplitude (~±4.8px, from buildStickWiggle below) so a
// full-strength gust reads unmistakably as wind, not the baseline jitter.
const MAX_STICK_SWAY_PX = 30;
// Eases displacement from ~0 at the grip (t=0, held fixed) to the full sway
// at the ember end (t=1, the free/hanging end) — >1 concentrates the bend
// toward the tip rather than tilting the whole stick like a rigid rod.
const STICK_SWAY_EASE_POWER = 1.6;
// A taut hanging thread mainly swings side-to-side; a gust pushing straight
// along the thread's length would otherwise read as the stick
// stretching/compressing rather than bending, so the along-thread component
// (dy, since the stick runs roughly vertical) is heavily damped relative to
// the across-thread component (dx).
const STICK_SWAY_VERTICAL_DAMPING = 0.3;

/**
 * Wind-sway displacement (px) at eased stick position `t` (0 = grip, held
 * fixed; 1 = ember end, full sway) — the single source of truth for both
 * the stick's own per-point bend (drawStick) and the ember/particle burst's
 * anchor (emberAnchorSway). Previously this easing math lived only inline
 * inside drawStick's per-point loop, so the ember and its spark burst kept
 * rendering at the static, unswayed geo.emberX/emberY point and visibly
 * separated from the stick's bent tip during a gust — computing it here
 * once and reusing it everywhere keeps them from drifting apart again.
 */
function stickSwayAt(t: number, gust: WindState): { x: number; y: number } {
  const easedT = Math.pow(t, STICK_SWAY_EASE_POWER);
  return {
    x: gust.dx * MAX_STICK_SWAY_PX * easedT,
    y: gust.dy * MAX_STICK_SWAY_PX * STICK_SWAY_VERTICAL_DAMPING * easedT,
  };
}

/**
 * The wind-sway offset at the stick's ember end (t=1) — how far the
 * ember glow and particle-burst anchor must be displaced from the static
 * geo.emberX/emberY to stay attached to the stick's actual swayed tip.
 * Exported so main.ts can apply the identical offset to the particle
 * system's spawn/simulation origin, not just to the renderer's own drawing.
 */
export function emberAnchorSway(gust: WindState): { x: number; y: number } {
  return stickSwayAt(1, gust);
}

/** Fixed, seeded wiggle points so the twisted-paper stick reads as hand-made, not jittery. */
function buildStickWiggle(): StickWiggle[] {
  const points: StickWiggle[] = [];
  const count = 10;
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const offset = Math.sin(i * 2.3) * 3.2 + Math.sin(i * 0.7) * 1.6;
    points.push({ t, offset });
  }
  return points;
}

export class SparklerRenderer {
  readonly sceneCanvas: HTMLCanvasElement;
  readonly afterglowCanvas: HTMLCanvasElement;
  private readonly sceneCtx: CanvasRenderingContext2D;
  private readonly afterglowCtx: CanvasRenderingContext2D;
  private readonly stickWiggle: StickWiggle[];
  private dpr = 1;
  private cssWidth = 0;
  private cssHeight = 0;

  constructor(sceneCanvas: HTMLCanvasElement) {
    this.sceneCanvas = sceneCanvas;
    const sceneCtx = sceneCanvas.getContext('2d');
    if (!sceneCtx) throw new Error('Canvas 2D context unavailable');
    this.sceneCtx = sceneCtx;

    // Offscreen (never attached to the DOM) long-exposure accumulation canvas.
    this.afterglowCanvas = document.createElement('canvas');
    const afterglowCtx = this.afterglowCanvas.getContext('2d');
    if (!afterglowCtx) throw new Error('Canvas 2D context unavailable');
    this.afterglowCtx = afterglowCtx;

    this.stickWiggle = buildStickWiggle();
    this.resize();
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.cssWidth = window.innerWidth;
    this.cssHeight = window.innerHeight;

    for (const canvas of [this.sceneCanvas, this.afterglowCanvas]) {
      canvas.width = Math.floor(this.cssWidth * this.dpr);
      canvas.height = Math.floor(this.cssHeight * this.dpr);
    }
    this.sceneCanvas.style.width = `${this.cssWidth}px`;
    this.sceneCanvas.style.height = `${this.cssHeight}px`;

    this.sceneCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.afterglowCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Long exposure starts from an opaque, matching background so the
    // exported photo reads as a real frame rather than a transparent PNG.
    this.afterglowCtx.fillStyle = BG_COLOR;
    this.afterglowCtx.fillRect(0, 0, this.cssWidth, this.cssHeight);
  }

  resetAfterglow(): void {
    this.afterglowCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.afterglowCtx.fillStyle = BG_COLOR;
    this.afterglowCtx.fillRect(0, 0, this.cssWidth, this.cssHeight);
  }

  /**
   * Dims the afterglow buffer toward the background color each frame so old
   * light contributions fade out over a bounded ~AFTERGLOW_WINDOW_SECONDS
   * window instead of accumulating for the entire ~45s burn. Accumulating
   * for the whole burn was tried first and saturated to a flat white blob —
   * a real long-exposure photo has a shutter time, not infinite exposure.
   * Exponential decay with time-constant window/3 leaves ~5% of a
   * contribution's brightness remaining after one full window has passed.
   */
  private fadeAfterglow(dt: number): void {
    const timeConstant = AFTERGLOW_WINDOW_SECONDS / 3;
    const decayAlpha = 1 - Math.exp(-dt / timeConstant);
    this.afterglowCtx.save();
    this.afterglowCtx.globalCompositeOperation = 'source-over';
    this.afterglowCtx.fillStyle = `rgba(10, 8, 6, ${decayAlpha})`;
    this.afterglowCtx.fillRect(0, 0, this.cssWidth, this.cssHeight);
    this.afterglowCtx.restore();
  }

  /**
   * `emberX`/`emberY` here are the static, un-swayed tip position — callers
   * that need the ember/burst's true current position under wind must add
   * emberAnchorSway(gust) themselves (see renderFrame and main.ts's
   * emberAnchor helper).
   */
  get geometry(): Geometry {
    return {
      width: this.cssWidth,
      height: this.cssHeight,
      emberX: this.cssWidth / 2,
      emberY: this.cssHeight * EMBER_Y_RATIO,
      handX: this.cssWidth / 2,
      handY: this.cssHeight * GRIP_Y_RATIO,
    };
  }

  private drawStick(ctx: CanvasRenderingContext2D, geo: Geometry, gust: WindState): void {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = PAPER_COLOR;
    ctx.lineWidth = 3;
    ctx.beginPath();
    this.stickWiggle.forEach((point, i) => {
      // gust.dx/dy are already scaled by 0..1 strength (see wind.ts); the
      // per-point grip-to-ember easing lives in stickSwayAt (see above) so
      // this stays in sync with the ember/particle anchor's own offset.
      const sway = stickSwayAt(point.t, gust);
      const y = geo.handY + (geo.emberY - geo.handY) * point.t + sway.y;
      const wobbleX = geo.handX + point.offset + sway.x;
      if (i === 0) ctx.moveTo(wobbleX, y);
      else ctx.lineTo(wobbleX, y);
    });
    ctx.stroke();

    ctx.strokeStyle = PAPER_HIGHLIGHT;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    ctx.stroke();
    ctx.restore();
  }

  /**
   * `anchorX`/`anchorY` is the stick tip's actual, already-swayed position
   * for this frame (see emberAnchorSway) — not the static geo.emberX/emberY
   * — so the glow stays visually attached to the stick's bent tip.
   */
  private drawEmber(
    ctx: CanvasRenderingContext2D,
    anchorX: number,
    anchorY: number,
    brightness: number,
    pulse: number,
  ): void {
    if (brightness <= 0.01) return;
    const radius = 5 + pulse * 2.5;
    const glowRadius = 14 + brightness * 22;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const gradient = ctx.createRadialGradient(anchorX, anchorY, 0, anchorX, anchorY, glowRadius);
    const coreAlpha = 0.85 * brightness;
    gradient.addColorStop(0, `rgba(255, 244, 214, ${coreAlpha})`);
    gradient.addColorStop(0.35, `rgba(255, 190, 110, ${coreAlpha * 0.6})`);
    gradient.addColorStop(1, 'rgba(255, 140, 66, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(anchorX, anchorY, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255, 250, 235, ${Math.min(1, brightness + 0.2)})`;
    ctx.beginPath();
    ctx.arc(anchorX, anchorY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * Draws each spark as its short jittered trail (see Particle.path) rather
   * than a static round point-sprite: a thin bright core stroke plus a wider
   * soft pass underneath for glow. Combined with the branch children the
   * physics layer already spawns, this is what makes the burst read as
   * forking filament threads (松葉/pine-needle-like) instead of a blooming
   * cloud of dots.
   */
  private drawParticles(ctx: CanvasRenderingContext2D, particles: readonly Particle[]): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const particle of particles) {
      const alpha = alphaAt(particle);
      if (alpha <= 0.01 || particle.path.length < 2) continue;
      const color = colorAt(particle);
      const rgb = `${color.r}, ${color.g}, ${color.b}`;

      ctx.beginPath();
      const first = particle.path[0]!;
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < particle.path.length; i++) {
        const point = particle.path[i]!;
        ctx.lineTo(point.x, point.y);
      }

      ctx.strokeStyle = `rgba(${rgb}, ${alpha * 0.32})`;
      ctx.lineWidth = Math.max(1, particle.size * 2.4);
      ctx.stroke();

      ctx.strokeStyle = `rgba(${rgb}, ${alpha})`;
      ctx.lineWidth = Math.max(0.5, particle.size * 0.65);
      ctx.stroke();

      const tip = particle.path[particle.path.length - 1]!;
      ctx.fillStyle = `rgba(${rgb}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, particle.size * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * Draws one frame: clears + redraws the live scene, and additively stamps
   * the afterglow. `pulseStrength` (0..1) is provided by the caller so this
   * module stays a pure drawing layer with no burn-curve knowledge.
   */
  renderFrame(
    dt: number,
    particles: readonly Particle[],
    emberBrightness: number,
    pulseStrength: number,
    showStick: boolean,
    gust: WindState,
  ): void {
    const geo = this.geometry;
    // Same offset the particle system's origin uses (see main.ts's
    // emberAnchor helper, built on this module's exported emberAnchorSway)
    // so the glow and the burst never disagree about where the tip is.
    const sway = emberAnchorSway(gust);
    const emberAnchorX = geo.emberX + sway.x;
    const emberAnchorY = geo.emberY + sway.y;

    this.sceneCtx.clearRect(0, 0, this.cssWidth, this.cssHeight);
    if (showStick) this.drawStick(this.sceneCtx, geo, gust);

    const pulse = pulseStrength * ((Math.sin(performance.now() / 260) + 1) / 2);
    this.drawEmber(this.sceneCtx, emberAnchorX, emberAnchorY, emberBrightness, pulse);
    this.drawParticles(this.sceneCtx, particles);

    // Afterglow: a bounded rolling exposure (see fadeAfterglow), not
    // infinite accumulation — this is the keepsake photo.
    this.fadeAfterglow(dt);
    this.drawParticles(this.afterglowCtx, particles);
  }

  toPngDataUrl(): string {
    return this.afterglowCanvas.toDataURL('image/png');
  }
}
