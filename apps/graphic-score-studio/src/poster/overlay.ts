import type { FrameInfo } from '../audio/engine';
import type { Layout } from './layout';

const SIGNAL = '#e4362c';

/**
 * Draws only the animated playhead + active-pitch highlights on a
 * transparent canvas stacked over the static poster render, so playback
 * never forces a full poster redraw (ink/text stay untouched each frame).
 */
export function renderOverlay(ctx: CanvasRenderingContext2D, layout: Layout, frame: FrameInfo | null): void {
  ctx.clearRect(0, 0, layout.posterW, layout.posterH);
  if (!frame) return;

  const { ink } = layout;
  const x = ink.x + frame.playheadX;

  ctx.save();
  ctx.strokeStyle = SIGNAL;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, ink.y - 14);
  ctx.lineTo(x, ink.y + ink.h + 14);
  ctx.stroke();

  // small tick caps, like a film scanner cue mark
  ctx.beginPath();
  ctx.moveTo(x - 6, ink.y - 14);
  ctx.lineTo(x + 6, ink.y - 14);
  ctx.moveTo(x - 6, ink.y + ink.h + 14);
  ctx.lineTo(x + 6, ink.y + ink.h + 14);
  ctx.stroke();

  for (const v of frame.voices) {
    const y = ink.y + v.yNorm * ink.h;
    const r = 4 + v.gainNorm * 10;
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = SIGNAL;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = SIGNAL;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ink.x, y);
    ctx.lineTo(ink.x + ink.w, y);
    ctx.globalAlpha = 0.16;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
