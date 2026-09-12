/**
 * Generates a bundled "sample target" image so the lab is usable before any
 * upload — a signal test card in the spirit of SMPTE colour bars, which
 * doubles as thematically on-brand content for a glitch/data-bending tool.
 * Drawn procedurally to avoid shipping a binary asset.
 */
export function drawSampleImage(canvas: HTMLCanvasElement, width = 1200, height = 900): void {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Colour bar field (top ~70%).
  const bars = ['#c8c8c8', '#c8c800', '#00c8c8', '#00c800', '#c800c8', '#c80000', '#0000c8'];
  const barHeight = height * 0.66;
  const barWidth = width / bars.length;
  bars.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(i * barWidth, 0, barWidth + 1, barHeight);
  });

  // Secondary reversed strip.
  const strip2 = ['#0000c8', '#141414', '#c800c8', '#141414', '#00c8c8', '#141414', '#c8c8c8'];
  const strip2Height = height * 0.12;
  strip2.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(i * barWidth, barHeight, barWidth + 1, strip2Height);
  });

  // Footer calibration strip: greyscale ramp + pluge.
  const footerY = barHeight + strip2Height;
  const footerHeight = height - footerY;
  const rampSteps = 10;
  const rampWidth = width * 0.72;
  for (let i = 0; i < rampSteps; i++) {
    const v = Math.round((i / (rampSteps - 1)) * 255);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect((i * rampWidth) / rampSteps, footerY, rampWidth / rampSteps + 1, footerHeight);
  }
  ctx.fillStyle = '#0a0a0d';
  ctx.fillRect(rampWidth, footerY, width - rampWidth, footerHeight);

  // Centre reticle / crosshair, evokes lab calibration equipment.
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  const cx = width / 2;
  const cy = barHeight / 2;
  const r = Math.min(width, height) * 0.14;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.moveTo(cx - r * 1.3, cy);
  ctx.lineTo(cx + r * 1.3, cy);
  ctx.moveTo(cx, cy - r * 1.3);
  ctx.lineTo(cx, cy + r * 1.3);
  ctx.stroke();

  // Label text, monospace, evokes a broadcast test card ident.
  ctx.fillStyle = 'rgba(10,10,13,0.88)';
  ctx.fillRect(cx - 150, cy - 18, 300, 36);
  ctx.fillStyle = '#e8e8ee';
  ctx.font = '600 20px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TEST TARGET 001 // GPL', cx, cy);

  // Flat colour-bar fields are the JPEG encoder's best case: they compress
  // to an almost empty entropy-coded scan region. That makes the sample
  // pathologically fragile — even a mild BYTE CORRUPTION RATE wipes out
  // most of the (tiny) real bitstream and the very first thing a
  // first-time visitor sees is a decode failure instead of a working demo.
  // A light grain pass gives the encoder real texture to spend bits on, so
  // default-strength corruption behaves the way it does on an ordinary
  // photo instead of this worst case.
  const grain = ctx.getImageData(0, 0, width, height);
  const d = grain.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 22;
    d[i] = Math.min(255, Math.max(0, (d[i] ?? 0) + n));
    d[i + 1] = Math.min(255, Math.max(0, (d[i + 1] ?? 0) + n));
    d[i + 2] = Math.min(255, Math.max(0, (d[i + 2] ?? 0) + n));
  }
  ctx.putImageData(grain, 0, 0);
}
