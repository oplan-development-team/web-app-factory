/**
 * 紋章を構成する基本図形（花弁・菱・丸・十字）のSVGマークアップ生成。
 * 各図形はローカル原点(0,0)を中心／基準に据え、呼び出し側で
 * translate + rotate を与えて配置する。
 */

export type ShapeKind = "petal" | "diamond" | "circle" | "cross";

export const SHAPE_LABEL: Record<ShapeKind, string> = {
  petal: "花弁",
  diamond: "菱",
  circle: "丸",
  cross: "十字",
};

export interface ShapeSpec {
  kind: ShapeKind;
  /** SVG座標系での中心位置 */
  x: number;
  y: number;
  /** 度数法。0=真上を向く、時計回りに増加 */
  rot: number;
  /** 図形の基準サイズ（半径・半径相当） */
  size: number;
  /** 図形ごとの縦横比バリエーション */
  aspect: number;
  /** true=塗り、false=線のみ */
  filled: boolean;
}

/** strokeの太さをsizeに応じてクランプする */
function strokeWidthFor(size: number): number {
  return Math.min(6, Math.max(1.6, size * 0.16));
}

/** 1つの図形をSVGマークアップ文字列にする */
export function renderShape(spec: ShapeSpec, ink: string): string {
  const { kind, x, y, rot, size, aspect, filled } = spec;
  const fillAttr = filled ? `fill="${ink}"` : "fill=\"none\"";
  const strokeAttr = filled
    ? ""
    : `stroke="${ink}" stroke-width="${strokeWidthFor(size).toFixed(2)}" stroke-linejoin="round"`;

  let inner: string;
  switch (kind) {
    case "petal": {
      const w = size * aspect;
      const d = `M0,${size.toFixed(2)} Q${w.toFixed(2)},0 0,${(-size).toFixed(2)} Q${(-w).toFixed(2)},0 0,${size.toFixed(2)} Z`;
      inner = `<path d="${d}" ${fillAttr} ${strokeAttr} stroke-linecap="round"/>`;
      break;
    }
    case "diamond": {
      const w = size * aspect;
      const d = `M0,${(-size).toFixed(2)} L${w.toFixed(2)},0 L0,${size.toFixed(2)} L${(-w).toFixed(2)},0 Z`;
      inner = `<path d="${d}" ${fillAttr} ${strokeAttr}/>`;
      break;
    }
    case "cross": {
      const thickness = Math.max(size * aspect, size * 0.18);
      const bar1 = `<rect x="${(-thickness / 2).toFixed(2)}" y="${(-size).toFixed(2)}" width="${thickness.toFixed(2)}" height="${(size * 2).toFixed(2)}" rx="${(thickness * 0.2).toFixed(2)}"/>`;
      const bar2 = `<rect x="${(-size).toFixed(2)}" y="${(-thickness / 2).toFixed(2)}" width="${(size * 2).toFixed(2)}" height="${thickness.toFixed(2)}" rx="${(thickness * 0.2).toFixed(2)}"/>`;
      inner = `<g ${fillAttr} ${strokeAttr}>${bar1}${bar2}</g>`;
      break;
    }
    case "circle": {
      inner = `<circle cx="0" cy="0" r="${size.toFixed(2)}" ${fillAttr} ${strokeAttr}/>`;
      break;
    }
  }

  return `<g transform="translate(${x.toFixed(2)},${y.toFixed(2)}) rotate(${rot.toFixed(2)})">${inner}</g>`;
}

/** 角度(度, 0=真上・時計回り)と中心・半径から絶対座標を求める */
export function polarToXY(cx: number, cy: number, angleDeg: number, radius: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + radius * Math.sin(rad),
    y: cy - radius * Math.cos(rad),
  };
}
