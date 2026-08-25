import type { Poem } from './types';

export function poemToPlainText(poem: Poem): string {
  return poem.lines.join('\n');
}

export async function copyPoemToClipboard(poem: Poem): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(poemToPlainText(poem));
    return true;
  } catch {
    return false;
  }
}

function wrapLine(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return [''];
  const chars = Array.from(text);
  const lines: string[] = [];
  let current = '';
  for (const ch of chars) {
    const test = current + ch;
    if (current && ctx.measureText(test).width > maxWidth) {
      lines.push(current);
      current = ch;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function drawDashedLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.save();
  ctx.strokeStyle = 'rgba(42,38,32,0.4)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

/** Renders the poem as a standalone thermal-receipt-style PNG using Canvas
 * 2D (no chassis chrome — just the printed poem strip, so the exported
 * image reads like a torn-off receipt) and triggers a download. */
export async function exportPoemAsPng(poem: Poem): Promise<void> {
  if (document.fonts) {
    await document.fonts.ready;
  }

  const width = 480;
  const paddingX = 30;
  const maxTextWidth = width - paddingX * 2;
  const lineHeight = 27;
  const blankHeight = 15;
  const headerHeight = 56;
  const footerHeight = 40;
  const bodyFont = '17px "DotGothic16", monospace';

  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = bodyFont;

  const wrapped: string[] = [];
  for (const line of poem.lines) {
    if (line === '') {
      wrapped.push('');
      continue;
    }
    wrapped.push(...wrapLine(measure, line, maxTextWidth));
  }

  const bodyHeight = wrapped.reduce((sum, l) => sum + (l === '' ? blankHeight : lineHeight), 0);
  const height = headerHeight + bodyHeight + footerHeight + 20;

  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  ctx.fillStyle = '#f4efe2';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = 'rgba(42,38,32,0.035)';
  for (let i = 0; i < 500; i++) {
    ctx.fillRect(Math.random() * width, Math.random() * height, 1, 1);
  }

  ctx.fillStyle = '#2a2620';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '600 19px "DotGothic16", monospace';
  ctx.fillText(`◆ FOUND POEM No.${String(poem.id).padStart(2, '0')} ◆`, width / 2, 30);

  drawDashedLine(ctx, 24, headerHeight - 12, width - 24, headerHeight - 12);

  ctx.textAlign = 'left';
  ctx.font = bodyFont;
  let y = headerHeight + 16;
  for (const line of wrapped) {
    if (line === '') {
      y += blankHeight;
      continue;
    }
    ctx.fillText(line, paddingX, y);
    y += lineHeight;
  }

  drawDashedLine(ctx, 24, height - footerHeight, width - 24, height - footerHeight);
  ctx.font = '12px "DotGothic16", monospace';
  ctx.fillStyle = '#6b6558';
  ctx.textAlign = 'center';
  ctx.fillText('CLIPBOARD POET · SESSION ONLY · NEVER SAVED', width / 2, height - footerHeight + 20);

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `clipboard-poet-poem-${String(poem.id).padStart(2, '0')}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
