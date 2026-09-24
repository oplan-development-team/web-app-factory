import type { Waveform } from './geometry';

const PHOSPHOR = '57, 255, 106';
const SCREEN_BG = '#04120a';

/** Render one full loop of the waveform at full brightness for PNG export. */
export function renderWaveformToPngBlob(waveform: Waveform, size = 900): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.46;

  ctx.fillStyle = SCREEN_BG;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = `rgba(${PHOSPHOR}, 1)`;
  ctx.lineWidth = Math.max(2, radius * 0.008);
  ctx.shadowColor = `rgba(${PHOSPHOR}, 1)`;
  ctx.shadowBlur = radius * 0.1;

  ctx.beginPath();
  ctx.moveTo(cx + waveform.x[0] * radius, cy + waveform.y[0] * radius);
  for (let i = 1; i < waveform.x.length; i++) {
    ctx.lineTo(cx + waveform.x[i] * radius, cy + waveform.y[i] * radius);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('PNG encoding failed'));
    }, 'image/png');
  });
}
