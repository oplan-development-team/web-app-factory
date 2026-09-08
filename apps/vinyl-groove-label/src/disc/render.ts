import type { DiscOptions } from '../types';
import { placeholderEnvelope } from '../audio/envelope';
import { clamp, lerpColor } from './colorUtils';
import { drawArcTextBottom, drawArcTextTop, drawFittedText } from './arcText';

const GROOVE_DARK = '#100e0b';
const GROOVE_LIGHT = '#4c4436';
const SENSITIVITY = 2.6;

/**
 * Renders the full vinyl disc + label onto a square canvas of the given
 * pixel size. Resolution-independent: the same function drives both the
 * live preview canvas and the high-resolution export canvas.
 */
export function renderDisc(ctx: CanvasRenderingContext2D, size: number, options: DiscOptions): void {
  const envelope = options.envelope ?? placeholderEnvelope();
  const { preset, text } = options;
  const mod = clamp(options.modStrength, 0, 1);

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.487;
  const grooveOuterR = outerR * 0.965;
  const labelR = outerR * 0.375;
  const grooveInnerR = labelR + outerR * 0.01;
  const spindleR = outerR * 0.024;

  ctx.clearRect(0, 0, size, size);

  // --- disc base -----------------------------------------------------
  ctx.save();
  const baseGrad = ctx.createRadialGradient(cx, cy - outerR * 0.15, outerR * 0.04, cx, cy, outerR);
  baseGrad.addColorStop(0, '#161310');
  baseGrad.addColorStop(0.55, '#0f0d0b');
  baseGrad.addColorStop(1, '#040302');
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.fillStyle = baseGrad;
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur = size * 0.03;
  ctx.shadowOffsetY = size * 0.012;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.lineWidth = size * 0.0016;
  ctx.strokeStyle = 'rgba(255,255,255,0.045)';
  ctx.stroke();
  ctx.restore();

  // --- grooves (clipped to disc) --------------------------------------
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.clip();

  const values = envelope.values;
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;

  const factors = new Float32Array(n);
  let sumFactors = 0;
  for (let i = 0; i < n; i++) {
    const f = clamp(1 + mod * SENSITIVITY * (values[i] - mean), 0.12, 3.2);
    factors[i] = f;
    sumFactors += f;
  }
  const totalWidth = grooveOuterR - grooveInnerR;
  const baseLineWidth = size * 0.00105;

  let r = grooveInnerR;
  for (let i = 0; i < n; i++) {
    const spacing = (factors[i] / sumFactors) * totalWidth;
    r += spacing;
    const env = values[i];

    const brightness = clamp(0.42 + (env - mean) * (0.75 + mod * 0.9), 0, 1);
    const color = lerpColor(GROOVE_DARK, GROOVE_LIGHT, brightness);
    let lw = baseLineWidth * (0.55 + env * (0.75 + mod * 1.15));
    lw = Math.min(lw, spacing * 0.82);
    lw = Math.max(lw, size * 0.00025);

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = lw;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.88;
    ctx.stroke();

    // groove channel shading: a faint dark inner edge + faint light outer edge
    ctx.beginPath();
    ctx.arc(cx, cy, r - lw * 0.65, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(0.4, lw * 0.22);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.globalAlpha = 0.45;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, r + lw * 0.65, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(0.4, lw * 0.18);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.globalAlpha = 0.4;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // --- theatrical specular highlight bands ----------------------------
  ctx.save();
  ctx.filter = `blur(${Math.max(2, size * 0.032)}px)`;
  ctx.globalCompositeOperation = 'screen';

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.55);
  const band1 = ctx.createLinearGradient(-outerR * 0.95, 0, outerR * 0.95, 0);
  band1.addColorStop(0, 'rgba(255,255,255,0)');
  band1.addColorStop(0.42, 'rgba(255,255,255,0)');
  band1.addColorStop(0.5, 'rgba(255,255,255,0.24)');
  band1.addColorStop(0.58, 'rgba(255,255,255,0)');
  band1.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = band1;
  ctx.fillRect(-outerR, -outerR * 0.6, outerR * 2, outerR * 0.32);
  ctx.restore();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.55);
  const band2 = ctx.createLinearGradient(-outerR * 0.95, 0, outerR * 0.95, 0);
  band2.addColorStop(0, 'rgba(255,255,255,0)');
  band2.addColorStop(0.5, 'rgba(255,255,255,0.11)');
  band2.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = band2;
  ctx.fillRect(-outerR, -outerR * 0.14, outerR * 2, outerR * 0.12);
  ctx.restore();

  ctx.restore(); // filter + composite reset

  ctx.restore(); // end groove clip

  // --- label -----------------------------------------------------------
  ctx.save();
  const labelGrad = ctx.createRadialGradient(cx, cy - labelR * 0.25, labelR * 0.05, cx, cy, labelR);
  labelGrad.addColorStop(0, preset.baseTint);
  labelGrad.addColorStop(1, preset.base);
  ctx.beginPath();
  ctx.arc(cx, cy, labelR, 0, Math.PI * 2);
  ctx.fillStyle = labelGrad;
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = size * 0.012;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  const ringGrad = ctx.createLinearGradient(cx - labelR, cy - labelR, cx + labelR, cy + labelR);
  ringGrad.addColorStop(0, preset.accentSoft);
  ringGrad.addColorStop(0.5, preset.accent);
  ringGrad.addColorStop(1, preset.accentSoft);
  ctx.lineWidth = size * 0.0042;
  ctx.strokeStyle = ringGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, labelR - ctx.lineWidth / 2, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = size * 0.0009;
  ctx.strokeStyle = preset.accentSoft;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.arc(cx, cy, labelR - size * 0.013, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();

  // --- label text --------------------------------------------------------
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, labelR - size * 0.006, 0, Math.PI * 2);
  ctx.clip();

  const artist = text.artist.trim().toUpperCase();
  const title = text.title.trim().toUpperCase();
  const catalog = text.catalogNumber.trim().toUpperCase();
  const side = text.sideLabel.trim().toUpperCase();

  drawArcTextTop(
    ctx,
    artist || 'ARTIST NAME',
    cx,
    cy,
    labelR * 0.82,
    `${Math.round(size * 0.0135)}px 'Space Mono', monospace`,
    preset.textMuted,
    size * 0.0016,
  );

  ctx.save();
  if (!title) ctx.globalAlpha = 0.42;
  drawFittedText(
    ctx,
    title || 'TITLE',
    cx,
    cy - labelR * 0.06,
    labelR * 1.45,
    Math.round(size * 0.034),
    Math.round(size * 0.014),
    "'Playfair Display', serif",
    title ? '700' : '400',
    title ? preset.text : preset.textMuted,
    0.02,
  );
  ctx.restore();

  const smallLine = [catalog, side].filter(Boolean).join('   •   ');
  if (smallLine) {
    ctx.font = `${Math.round(size * 0.0105)}px 'Space Mono', monospace`;
    ctx.fillStyle = preset.textMuted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(smallLine, cx, cy + labelR * 0.2);
  }

  drawArcTextBottom(
    ctx,
    '33⅓ RPM • STEREO',
    cx,
    cy,
    labelR * 0.82,
    `${Math.round(size * 0.0115)}px 'Space Mono', monospace`,
    preset.textMuted,
    size * 0.0016,
  );

  ctx.restore();

  // --- spindle hole --------------------------------------------------
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, spindleR, 0, Math.PI * 2);
  ctx.fillStyle = '#020202';
  ctx.fill();
  ctx.lineWidth = size * 0.0016;
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath();
  ctx.arc(cx, cy, spindleR + size * 0.0016, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.arc(cx, cy, spindleR - size * 0.0012, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
