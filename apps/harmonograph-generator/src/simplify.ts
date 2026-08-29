export interface Pt {
  x: number;
  y: number;
}

function perpendicularDistance(pt: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) {
    return Math.hypot(pt.x - a.x, pt.y - a.y);
  }
  // 直線 a-b への垂線距離 (外積の絶対値 / 底辺長)
  const cross = Math.abs(dy * (pt.x - a.x) - dx * (pt.y - a.y));
  return cross / Math.sqrt(lengthSq);
}

/**
 * Ramer-Douglas-Peucker によるパス簡略化 (自前実装)。
 * スタックベースの反復実装で、大きな点列でも再帰深度の問題を避ける。
 */
export function simplifyRDP<T extends Pt>(points: T[], epsilon: number): T[] {
  const n = points.length;
  if (n < 3 || epsilon <= 0) return points.slice();

  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;

  const stack: [number, number][] = [[0, n - 1]];

  while (stack.length > 0) {
    const range = stack.pop();
    if (!range) continue;
    const [start, end] = range;
    if (end - start < 2) continue;

    let maxDist = -1;
    let maxIndex = -1;
    const a = points[start];
    const b = points[end];
    if (!a || !b) continue;

    for (let i = start + 1; i < end; i++) {
      const pt = points[i];
      if (!pt) continue;
      const dist = perpendicularDistance(pt, a, b);
      if (dist > maxDist) {
        maxDist = dist;
        maxIndex = i;
      }
    }

    if (maxDist > epsilon && maxIndex !== -1) {
      keep[maxIndex] = 1;
      stack.push([start, maxIndex]);
      stack.push([maxIndex, end]);
    }
  }

  const result: T[] = [];
  for (let i = 0; i < n; i++) {
    if (keep[i]) {
      const pt = points[i];
      if (pt) result.push(pt);
    }
  }
  return result;
}
