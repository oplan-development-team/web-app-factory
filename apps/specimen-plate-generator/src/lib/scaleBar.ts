export type ScaleUnit = "cm" | "mm" | "in";

export interface ScaleMark {
  frac: number; // 0-1（バー内の相対位置）
  value: number;
  isLast: boolean;
}

export interface ScaleData {
  segments: number;
  marks: ScaleMark[];
  unit: ScaleUnit;
  totalValue: number;
}

function formatValue(v: number): string {
  const rounded = Math.round(v * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

/**
 * スケールバーの目盛り位置を計算する。0〜totalValueの区間を、見やすいセグメント数
 * （実測値が2〜10の整数ならその数、それ以外は5等分）に分割する。
 */
export function computeScale(totalValue: number, unit: ScaleUnit): ScaleData {
  const value = Math.max(0.1, totalValue);
  let segments = 5;
  if (Number.isInteger(value) && value >= 2 && value <= 8) {
    segments = value;
  }
  segments = Math.max(1, Math.min(10, segments));

  const step = value / segments;
  const marks: ScaleMark[] = [];
  for (let i = 0; i <= segments; i++) {
    marks.push({ frac: i / segments, value: step * i, isLast: i === segments });
  }
  return { segments, marks, unit, totalValue: value };
}

export function scaleMarkLabel(mark: ScaleMark, unit: ScaleUnit): string {
  return mark.isLast ? `${formatValue(mark.value)} ${unit}` : formatValue(mark.value);
}
