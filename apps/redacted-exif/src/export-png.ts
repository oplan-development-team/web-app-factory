import type { ParsedMeta } from './meta';

export interface ExportArgs {
  file: File;
  meta: ParsedMeta;
  docNo: string;
  receiptNo: string;
  issueDate: string;
}

const PAPER = '#f4f1e8';
const LINE = '#55503f';
const INK = '#1c1a16';
const INK_SOFT = '#4a453c';
const VERMILLION = '#c8102e';

const RISK_LABEL = { high: '高', medium: '中', low: '低' } as const;

// Canvas fillText does not do the same automatic cross-family glyph
// fallback that DOM/CSS text rendering does, so every family used on the
// canvas needs the CJK-capable face listed directly (not relegated to a
// generic `monospace` fallback that has no kanji glyphs at all).
const SANS_STACK = '"Noto Sans JP", sans-serif';
const SERIF_STACK = '"Noto Serif JP", serif';
const MONO_STACK = '"JetBrains Mono", "Noto Sans JP", monospace';

/** Renders the current findings as a single flattened "決定書" PNG via <canvas>, then downloads it. */
export async function exportDecisionPng(args: ExportArgs): Promise<void> {
  const { file, meta, docNo, receiptNo, issueDate } = args;
  const width = 1000;
  const rowH = 56;
  const headerH = 260;
  const footerH = 90;
  const height = headerH + 60 + Math.max(1, meta.fields.length) * rowH + footerH;

  // Google Fonts serves CJK families as many unicode-range-sharded files;
  // the browser only fetches the shards that cover characters actually
  // used in DOM text. `document.fonts.load(font, text)` must be given the
  // *real* text we're about to draw so the shards containing those exact
  // kanji get fetched — otherwise canvas silently drops unfetched glyphs
  // even after `document.fonts.ready` resolves.
  const sampleText = [
    '内閣府　情報公開・個人情報保護室　写真解析第三課',
    '黒塗り開示決定書',
    'METADATA DISCLOSURE DECISION (REDACTED COPY)',
    `文書番号　${docNo}`,
    `発行日　${issueDate}`,
    `対象物件　${file.name}`,
    '特定リスク',
    RISK_LABEL.high,
    RISK_LABEL.medium,
    RISK_LABEL.low,
    '別紙　検出項目目録',
    '該当なし（開示すべき情報は検出されませんでした）',
    ...meta.fields.map((f) => f.label),
    ...meta.fields.map((f) => f.value),
    '非該当・開示',
    '黒塗り',
    `受付番号　${receiptNo}`,
    '1／1　頁',
  ].join('\n');

  try {
    await Promise.all([
      document.fonts.load('900 34px "Noto Serif JP"', sampleText),
      document.fonts.load('700 16px "Noto Serif JP"', sampleText),
      document.fonts.load('400 14px "Noto Sans JP"', sampleText),
      document.fonts.load('600 14px "Noto Sans JP"', sampleText),
      document.fonts.load('700 14px "Noto Sans JP"', sampleText),
      document.fonts.load('600 11px "Noto Sans JP"', sampleText),
      document.fonts.load('600 13px "Noto Sans JP"', sampleText),
      document.fonts.load('400 12px "Noto Sans JP"', sampleText),
      document.fonts.load('400 13px "JetBrains Mono"', sampleText),
    ]);
    await document.fonts.ready;
  } catch {
    // Best-effort; canvas will fall back to system fonts if this fails.
  }

  const canvas = document.createElement('canvas');
  const scale = 2;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(scale, scale);

  // paper background
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, width, height);

  // double outer frame
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, width - 32, height - 32);
  ctx.lineWidth = 1;
  ctx.strokeRect(24, 24, width - 48, height - 48);

  const padX = 56;
  let y = 70;

  ctx.fillStyle = INK_SOFT;
  ctx.font = `600 14px ${SANS_STACK}`;
  ctx.fillText('内閣府　情報公開・個人情報保護室　写真解析第三課', padX, y);

  y += 44;
  ctx.fillStyle = INK;
  ctx.font = `900 34px ${SERIF_STACK}`;
  ctx.fillText('黒塗り開示決定書', padX, y);

  y += 26;
  ctx.fillStyle = INK_SOFT;
  ctx.font = `400 13px ${MONO_STACK}`;
  ctx.fillText('METADATA DISCLOSURE DECISION (REDACTED COPY)', padX, y);

  y += 34;
  ctx.font = `600 13px ${MONO_STACK}`;
  ctx.fillStyle = INK;
  ctx.fillText(`文書番号  ${docNo}`, padX, y);
  ctx.fillText(`発行日  ${issueDate}`, padX + 340, y);

  y += 24;
  ctx.fillText(`対象物件  ${truncate(file.name, 40)}`, padX, y);

  // risk stamp
  ctx.save();
  const stampX = width - 150;
  const stampY = 96;
  ctx.translate(stampX, stampY);
  ctx.rotate((-7 * Math.PI) / 180);
  ctx.strokeStyle = VERMILLION;
  ctx.lineWidth = 3;
  ctx.strokeRect(-70, -34, 140, 68);
  ctx.strokeRect(-64, -28, 128, 56);
  ctx.fillStyle = VERMILLION;
  ctx.font = `700 13px ${SANS_STACK}`;
  ctx.textAlign = 'center';
  ctx.fillText('特定リスク', 0, -6);
  ctx.font = `900 26px ${SERIF_STACK}`;
  ctx.fillText(RISK_LABEL[meta.risk], 0, 24);
  ctx.textAlign = 'left';
  ctx.restore();

  y += 26;
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, y);
  ctx.lineTo(width - padX, y);
  ctx.stroke();

  y += 34;
  ctx.font = `700 16px ${SERIF_STACK}`;
  ctx.fillStyle = INK;
  ctx.fillText('別紙　検出項目目録', padX, y);
  y += 26;

  if (meta.fields.length === 0) {
    ctx.font = `400 14px ${SANS_STACK}`;
    ctx.fillStyle = INK_SOFT;
    ctx.fillText('該当なし（開示すべき情報は検出されませんでした）', padX, y + 20);
    y += rowH;
  } else {
    for (const field of meta.fields) {
      y += rowH;
      ctx.strokeStyle = '#c9c2ab';
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(padX, y - rowH + 18);
      ctx.lineTo(width - padX, y - rowH + 18);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = `700 14px ${SANS_STACK}`;
      ctx.fillStyle = INK;
      ctx.fillText(field.label, padX, y - 14);

      const valueX = padX + 220;
      if (field.cls === 'benign') {
        ctx.font = `400 14px ${MONO_STACK}`;
        ctx.fillStyle = INK_SOFT;
        ctx.fillText(truncate(field.value, 46), valueX, y - 14);
        ctx.font = `600 11px ${SANS_STACK}`;
        ctx.fillStyle = '#3f6b3f';
        ctx.fillText('非該当・開示', width - padX - 90, y - 14);
      } else {
        const barW = 300;
        const barH = 22;
        const barY = y - 30;
        ctx.fillStyle = INK;
        ctx.fillRect(valueX, barY, barW, barH);
        // slightly ragged edge suggestion using a couple of notches
        ctx.fillRect(valueX - 3, barY + 4, 5, barH - 10);
        ctx.fillRect(valueX + barW - 2, barY + 3, 5, barH - 8);
        ctx.font = `600 11px ${SANS_STACK}`;
        ctx.fillStyle = VERMILLION;
        ctx.fillText('黒塗り', width - padX - 60, y - 14);
      }
    }
  }

  y += 50;
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(padX, y);
  ctx.lineTo(width - padX, y);
  ctx.stroke();

  ctx.font = `400 12px ${MONO_STACK}`;
  ctx.fillStyle = INK_SOFT;
  ctx.fillText(`受付番号 ${receiptNo}`, padX, y + 26);
  ctx.textAlign = 'right';
  ctx.fillText('1／1　頁', width - padX, y + 26);
  ctx.textAlign = 'left';

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${stripExt(file.name)}_disclosure-decision.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function stripExt(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}
