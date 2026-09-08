import { PAPER_SIZE_MM } from './constants';
import { simplifyRDP } from './simplify';
import type { TrajectoryPoint } from './types';

export interface SvgPassInput {
  points: TrajectoryPoint[];
  color: string;
}

function buildPathD(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  const first = points[0];
  if (!first) return '';
  const parts: string[] = [`M ${first.x.toFixed(3)},${first.y.toFixed(3)}`];
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (!p) continue;
    parts.push(`L ${p.x.toFixed(3)},${p.y.toFixed(3)}`);
  }
  return parts.join(' ');
}

/**
 * プロッター送稿用の単一クリーンパスSVGを組み立てる。
 * mm単位の実寸viewBoxを持ち、ノード数はRDP簡略化 (自前実装) で抑える。
 * 2パス時は色ごとに <g> レイヤーを分離する。
 */
export function buildHarmonographSVG(
  passes: SvgPassInput[],
  rdpToleranceMm: number,
  strokeWidthMm = 0.28,
): string {
  const groups = passes
    .map((pass, i) => {
      const simplified = simplifyRDP(pass.points, rdpToleranceMm);
      const d = buildPathD(simplified);
      return `  <g id="pass-${i + 1}" fill="none" stroke="${pass.color}" stroke-width="${strokeWidthMm}" stroke-linecap="round" stroke-linejoin="round">\n    <path d="${d}" />\n  </g>`;
    })
    .join('\n');

  const totalRaw = passes.reduce((sum, p) => sum + p.points.length, 0);
  const totalSimplified = passes.reduce(
    (sum, p) => sum + simplifyRDP(p.points, rdpToleranceMm).length,
    0,
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- harmonograph-generator: プロッター送稿用パス書き出し -->
<!-- 元サンプル点数: ${totalRaw} / 簡略化後: ${totalSimplified} (RDP許容誤差 ${rdpToleranceMm}mm) -->
<svg xmlns="http://www.w3.org/2000/svg" width="${PAPER_SIZE_MM}mm" height="${PAPER_SIZE_MM}mm" viewBox="0 0 ${PAPER_SIZE_MM} ${PAPER_SIZE_MM}">
${groups}
</svg>
`;
}

export function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
